import { useState, useEffect, useRef } from "react";
import Papa from "papaparse";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Plus, Trash2, Upload, ChefHat, Package, Receipt, LayoutDashboard, AlertTriangle, TrendingDown, TrendingUp, X, Calculator, Users, Zap, Building2, Clock, Lightbulb, Star, ArrowUpRight, ArrowDownRight, MoreHorizontal, CircleDollarSign, Droplet } from "lucide-react";

const uid = () => Math.random().toString(36).slice(2, 10);
const norm = (s) => (s || "").trim().toLowerCase();
const money = (n) => `€${(Number(n) || 0).toFixed(2)}`;
const num = (n, d = 2) => (Number(n) || 0).toFixed(d);

// Unit handling: mass (g/kg) and volume (ml/l) are normalized to a common base (g, ml)
// so entries in different units for the same ingredient still compare correctly.
// Anything else (unit, portion, box, etc.) is treated as its own dimension —
// mixing two different count-like units for the same ingredient is flagged, not guessed at.
function classifyUnit(unit) {
  const u = norm(unit);
  if (["g", "gram", "grams"].includes(u)) return { dim: "mass", base: "g", factor: 1 };
  if (["kg", "kilogram", "kilograms"].includes(u)) return { dim: "mass", base: "g", factor: 1000 };
  if (["ml", "milliliter", "milliliters", "millilitre", "millilitres"].includes(u)) return { dim: "volume", base: "ml", factor: 1 };
  if (["l", "liter", "liters", "litre", "litres"].includes(u)) return { dim: "volume", base: "ml", factor: 1000 };
  const raw = u || "unit";
  return { dim: `count:${raw}`, base: raw, factor: 1 };
}
const toBase = (qty, unit) => {
  const c = classifyUnit(unit);
  return { value: (Number(qty) || 0) * c.factor, base: c.base, dim: c.dim };
};
const formatQty = (value, base) => {
  if (base === "g" && value >= 1000) return `${num(value / 1000, 2)} kg`;
  if (base === "ml" && value >= 1000) return `${num(value / 1000, 2)} l`;
  if (base === "g" || base === "ml") return `${num(value, 1)} ${base}`;
  return `${num(value, Number.isInteger(value) ? 0 : 1)} ${base}`;
};

const SAMPLE_OVERHEAD = { kitchenLabor: 0, tableLabor: 0, otherLabor: 0, buildingCost: 0, energyCost: 0, waterCost: 0, otherCost: 0, method: "even" };
const OVERHEAD_KEYS = ["kitchenLabor", "tableLabor", "otherLabor", "buildingCost", "energyCost", "waterCost", "otherCost"];

function periodDaysFromSales(sales) {
  const times = sales.map((s) => new Date(s.date).getTime()).filter((t) => !isNaN(t));
  if (times.length === 0) return 30; // no usable dates — treat the monthly figure as-is
  const span = Math.round((Math.max(...times) - Math.min(...times)) / 86400000) + 1;
  return Math.max(span, 1);
}

// Sample data: real menu, sales, and purchase records from restaurant "Tás Cá Dentro"
// (purchases are a plausible reconstruction since the restaurant doesn't track them —
// see the conversation for how each dataset was built and cleaned).
const MENU_CSV_RAW = `dish,category,price,ingredient,qty,unit,prepTime
Ameijoas à Bulhão Pato,Entradas,12.0,Ameijoas,400,g,12
Ameijoas à Bulhão Pato,Entradas,12.0,Alho,10,g,12
Ameijoas à Bulhão Pato,Entradas,12.0,Coentros,5,g,12
Ameijoas à Bulhão Pato,Entradas,12.0,Azeite,20,ml,12
Ameijoas à Bulhão Pato,Entradas,12.0,Vinho branco,30,ml,12
Ameijoas à Bulhão Pato,Entradas,12.0,Limão,10,g,12
Polvo à Lagareiro,Pratos Peixe,17.0,Polvo,300,g,20
Polvo à Lagareiro,Pratos Peixe,17.0,Batata a murro,200,g,20
Polvo à Lagareiro,Pratos Peixe,17.0,Azeite,40,ml,20
Polvo à Lagareiro,Pratos Peixe,17.0,Alho,10,g,20
Taça de Gelado,Sobremesas,3.0,Gelado,100,g,2
Café,Cafeteria,0.8,Café moído,7,g,2
Menu Degustação Simples,Diversos,15.0,,,,
Menu Degustação Intermédio,Diversos,18.0,,,,
Bacalhau à Brás,Pratos Peixe,12.5,Bacalhau desfiado,200,g,15
Bacalhau à Brás,Pratos Peixe,12.5,Batata palha,150,g,15
Bacalhau à Brás,Pratos Peixe,12.5,Ovos,3,unit,15
Bacalhau à Brás,Pratos Peixe,12.5,Cebola,40,g,15
Bacalhau à Brás,Pratos Peixe,12.5,Azeite,20,ml,15
Bacalhau à Brás,Pratos Peixe,12.5,Azeitonas,15,g,15
Sopa,Entradas,1.0,Legumes variados,200,g,5
Sopa,Entradas,1.0,Azeite,10,ml,5
Prego,Entradas,6.0,Bife de vaca,120,g,8
Prego,Entradas,6.0,Pão,80,g,8
Prego,Entradas,6.0,Alho,5,g,8
Prego,Entradas,6.0,Mostarda,8,g,8
Prego,Entradas,6.0,Azeite,10,ml,8
Maça Assada,Sobremesas,2.0,Maçã,180,g,5
Maça Assada,Sobremesas,2.0,Açúcar,15,g,5
Maça Assada,Sobremesas,2.0,Canela,2,g,5
Pera Bêbada,Sobremesas,2.0,Pera,150,g,5
Pera Bêbada,Sobremesas,2.0,Vinho tinto,100,ml,5
Pera Bêbada,Sobremesas,2.0,Açúcar,30,g,5
Pera Bêbada,Sobremesas,2.0,Canela,2,g,5
Alheira,Entradas,6.0,Alheira,150,g,8
Alheira,Entradas,6.0,Azeite,5,ml,8
Camarao ao alho,Entradas,10.0,Camarão,180,g,10
Camarao ao alho,Entradas,10.0,Alho,10,g,10
Camarao ao alho,Entradas,10.0,Malagueta,2,g,10
Camarao ao alho,Entradas,10.0,Azeite,20,ml,10
Chá,Cafeteria,1.0,Saqueta de chá,1,unit,2
Chá,Cafeteria,1.0,Água,200,ml,2
Batata dose,Diversos,3.0,Batata,200,g,12
Batata dose,Diversos,3.0,Azeite,15,ml,12
Camarão da Costa,Entradas,6.0,Camarão da costa,200,g,10
Polvo Ensalsado,Entradas,6.0,Polvo cozido,180,g,8
Polvo Ensalsado,Entradas,6.0,Cebola,30,g,8
Polvo Ensalsado,Entradas,6.0,Azeite,20,ml,8
Polvo Ensalsado,Entradas,6.0,Vinagre,10,ml,8
Polvo Ensalsado,Entradas,6.0,Salsa,3,g,8
Pica-pau,Entradas,12.0,Carne de vaca,200,g,12
Pica-pau,Entradas,12.0,Alho,10,g,12
Pica-pau,Entradas,12.0,Mostarda,10,g,12
Pica-pau,Entradas,12.0,Vinho branco,20,ml,12
Pica-pau,Entradas,12.0,Azeite,15,ml,12
Melão com Presunto,Entradas,4.5,Melão,200,g,5
Melão com Presunto,Entradas,4.5,Presunto,40,g,5
Chouriço Assado,Entradas,7.0,Chouriço,150,g,10
Chouriço Assado,Entradas,7.0,Aguardente,15,ml,10
Pudim,Sobremesas,3.0,"Pudim (leite, ovos, açúcar)",120,g,3
Salada,Diversos,2.5,Alface,80,g,5
Salada,Diversos,2.5,Tomate,60,g,5
Salada,Diversos,2.5,Cebola,15,g,5
Salada,Diversos,2.5,Azeite,10,ml,5
Salada,Diversos,2.5,Vinagre,5,ml,5
Carne de Porco à Alentejana,Pratos Carne,13.0,Entrecosto de porco,200,g,18
Carne de Porco à Alentejana,Pratos Carne,13.0,Ameijoas,200,g,18
Carne de Porco à Alentejana,Pratos Carne,13.0,Batata frita,120,g,18
Carne de Porco à Alentejana,Pratos Carne,13.0,Alho,10,g,18
Carne de Porco à Alentejana,Pratos Carne,13.0,Coentros,5,g,18
Carne de Porco à Alentejana,Pratos Carne,13.0,Azeite,15,ml,18
Cataplana de Peixe 2Pax,Pratos Peixe,26.0,Peixe variado,350,g,25
Cataplana de Peixe 2Pax,Pratos Peixe,26.0,Marisco,150,g,25
Cataplana de Peixe 2Pax,Pratos Peixe,26.0,Tomate,100,g,25
Cataplana de Peixe 2Pax,Pratos Peixe,26.0,Cebola,60,g,25
Cataplana de Peixe 2Pax,Pratos Peixe,26.0,Pimento,50,g,25
Cataplana de Peixe 2Pax,Pratos Peixe,26.0,Vinho branco,40,ml,25
Cataplana de Peixe 2Pax,Pratos Peixe,26.0,Azeite,20,ml,25
Arroz de Marisco 2Pax,Pratos Peixe,26.0,Arroz,250,g,25
Arroz de Marisco 2Pax,Pratos Peixe,26.0,Marisco variado,400,g,25
Arroz de Marisco 2Pax,Pratos Peixe,26.0,Tomate,80,g,25
Arroz de Marisco 2Pax,Pratos Peixe,26.0,Cebola,40,g,25
Arroz de Marisco 2Pax,Pratos Peixe,26.0,Azeite,20,ml,25
Arroz de Marisco 2Pax,Pratos Peixe,26.0,Coentros,5,g,25
Picanha,Pratos Carne,15.0,Picanha,250,g,18
Picanha,Pratos Carne,15.0,Arroz,100,g,18
Picanha,Pratos Carne,15.0,Batata frita,100,g,18
Filetes Peixe Galo,Pratos Peixe,13.5,Filetes de peixe galo,220,g,15
Filetes Peixe Galo,Pratos Peixe,13.5,Batata,150,g,15
Filetes Peixe Galo,Pratos Peixe,13.5,Azeite,15,ml,15
Filetes de Polvo,Pratos Peixe,13.5,Filetes de polvo,220,g,15
Filetes de Polvo,Pratos Peixe,13.5,Batata cozida,150,g,15
Filetes de Polvo,Pratos Peixe,13.5,Azeite,20,ml,15
Filetes de Polvo,Pratos Peixe,13.5,Alho,10,g,15
Arroz de Tamboril,Pratos Peixe,13.0,Tamboril,200,g,20
Arroz de Tamboril,Pratos Peixe,13.0,Arroz,180,g,20
Arroz de Tamboril,Pratos Peixe,13.0,Camarão,60,g,20
Arroz de Tamboril,Pratos Peixe,13.0,Tomate,60,g,20
Arroz de Tamboril,Pratos Peixe,13.0,Azeite,15,ml,20
Arroz de Polvo,Pratos Peixe,13.0,Polvo,200,g,20
Arroz de Polvo,Pratos Peixe,13.0,Arroz,180,g,20
Arroz de Polvo,Pratos Peixe,13.0,Tomate,60,g,20
Arroz de Polvo,Pratos Peixe,13.0,Cebola,40,g,20
Arroz de Polvo,Pratos Peixe,13.0,Azeite,15,ml,20
Entrecôte,Pratos Carne,14.0,Entrecôte,250,g,15
Entrecôte,Pratos Carne,14.0,Batata frita,150,g,15
Entrecôte,Pratos Carne,14.0,Molho,30,ml,15
Bacalhau à Lagareiro,Pratos Peixe,15.0,Lombo de bacalhau,250,g,20
Bacalhau à Lagareiro,Pratos Peixe,15.0,Batata a murro,200,g,20
Bacalhau à Lagareiro,Pratos Peixe,15.0,Azeite,40,ml,20
Bacalhau à Lagareiro,Pratos Peixe,15.0,Alho,10,g,20
Bife de Atum,Pratos Peixe,13.0,Bife de atum,220,g,12
Bife de Atum,Pratos Peixe,13.0,Legumes salteados,100,g,12
Bife de Atum,Pratos Peixe,13.0,Azeite,15,ml,12
Coxa de Pato Confitada,Pratos Carne,13.0,Coxa de pato,250,g,12
Coxa de Pato Confitada,Pratos Carne,13.0,Batata,150,g,12
Coxa de Pato Confitada,Pratos Carne,13.0,Azeite,10,ml,12
Bife Lombo,Pratos Carne,15.5,Lombo de vaca,220,g,15
Bife Lombo,Pratos Carne,15.5,Batata frita,150,g,15
Bife Lombo,Pratos Carne,15.5,Azeite,15,ml,15
Bife Lombo,Pratos Carne,15.5,Alho,5,g,15
Arroz de Rabo de Boi,Pratos Carne,13.0,Rabo de boi,200,g,20
Arroz de Rabo de Boi,Pratos Carne,13.0,Arroz,150,g,20
Arroz de Rabo de Boi,Pratos Carne,13.0,Cenoura,40,g,20
Arroz de Rabo de Boi,Pratos Carne,13.0,Cebola,30,g,20
Arroz de Rabo de Boi,Pratos Carne,13.0,Vinho tinto,30,ml,20
Magret de Pato,Pratos Carne,13.5,Peito de pato,220,g,15
Magret de Pato,Pratos Carne,13.5,Batata,150,g,15
Magret de Pato,Pratos Carne,13.5,Molho de frutos vermelhos,40,ml,15
Tostas de Rabo de Boi,Entradas,2.0,Rabo de boi desfiado,100,g,8
Tostas de Rabo de Boi,Entradas,2.0,Pão,60,g,8
Sopa de Peixe,Entradas,3.5,Peixe variado,150,g,8
Sopa de Peixe,Entradas,3.5,Legumes,100,g,8
Sopa de Peixe,Entradas,3.5,Tomate,50,g,8
Sopa de Peixe,Entradas,3.5,Azeite,15,ml,8
Ovos Rotos,Entradas,10.0,Ovos,3,unit,12
Ovos Rotos,Entradas,10.0,Batata palha,150,g,12
Ovos Rotos,Entradas,10.0,Presunto,60,g,12
Ovos Rotos,Entradas,10.0,Azeite,15,ml,12
Arroz Doce,Sobremesas,3.0,Arroz,60,g,5
Arroz Doce,Sobremesas,3.0,Leite,200,ml,5
Arroz Doce,Sobremesas,3.0,Açúcar,40,g,5
Arroz Doce,Sobremesas,3.0,Canela,2,g,5
Fruta,Sobremesas,1.0,Fruta da época,150,g,3
Arroz dose,Diversos,1.0,Arroz,120,g,10
Arroz dose,Diversos,1.0,Azeite,5,ml,10
Legumes Salteados,Diversos,2.5,Legumes variados,180,g,10
Legumes Salteados,Diversos,2.5,Azeite,10,ml,10
Legumes Salteados,Diversos,2.5,Alho,3,g,10
Arroz Conquilhas,Diversos,4.5,Arroz,100,g,15
Arroz Conquilhas,Diversos,4.5,Conquilhas,150,g,15
Arroz Conquilhas,Diversos,4.5,Azeite,10,ml,15
Arroz Conquilhas,Diversos,4.5,Alho,5,g,15
Arroz Conquilhas,Diversos,4.5,Coentros,3,g,15
Feijão Preto,Diversos,3.0,Feijão preto cozido,180,g,10
Feijão Preto,Diversos,3.0,Cebola,20,g,10
Feijão Preto,Diversos,3.0,Alho,5,g,10
Feijão Preto,Diversos,3.0,Azeite,10,ml,10
Couvert,Entradas,1.5,Pão,100,g,2
Couvert,Entradas,1.5,Manteiga,20,g,2
Couvert,Entradas,1.5,Azeitonas,30,g,2
Doce da casa,Sobremesas,3.5,Ingredientes variados,100,g,5
Omelete Camarão,Pratos Peixe,12.0,Ovos,3,unit,10
Omelete Camarão,Pratos Peixe,12.0,Camarão,100,g,10
Omelete Camarão,Pratos Peixe,12.0,Azeite,10,ml,10
Delicia de Chocolate,Sobremesas,3.5,Bolo de chocolate,100,g,5
Delicia de Chocolate,Sobremesas,3.5,Chocolate,20,g,5
Dourada/Robalo Grelhado,Pratos Peixe,12.5,Peixe inteiro,350,g,18
Dourada/Robalo Grelhado,Pratos Peixe,12.5,Batata cozida,150,g,18
Dourada/Robalo Grelhado,Pratos Peixe,12.5,Azeite,15,ml,18
Dourada/Robalo Grelhado,Pratos Peixe,12.5,Limão,10,g,18
Sandwich Club,Entradas,8.0,Pão de forma,100,g,10
Sandwich Club,Entradas,8.0,Frango,100,g,10
Sandwich Club,Entradas,8.0,Bacon,30,g,10
Sandwich Club,Entradas,8.0,Alface,20,g,10
Sandwich Club,Entradas,8.0,Tomate,30,g,10
Sandwich Club,Entradas,8.0,Maionese,15,g,10
Ovo estrelado,Diversos,0.25,Ovo,1,unit,3
Ovo estrelado,Diversos,0.25,Azeite,5,ml,3
Take Away,Diversos,0.5,,,,
Arroz de Pato,Pratos Carne,12.0,Pato desfiado,150,g,15
Arroz de Pato,Pratos Carne,12.0,Arroz,150,g,15
Arroz de Pato,Pratos Carne,12.0,Chouriço,40,g,15
Arroz de Pato,Pratos Carne,12.0,Azeite,10,ml,15
Posta,Pratos Carne,10.15,Posta de vaca,300,g,18
Posta,Pratos Carne,10.15,Batata cozida,150,g,18
Posta,Pratos Carne,10.15,Azeite,20,ml,18
Posta,Pratos Carne,10.15,Alho,10,g,18
Camarão costa (Peq.),Entradas,1.8,Camarão da costa,100,g,8
Mousse Maracujá,Sobremesas,2.0,Polpa de maracujá,40,g,5
Mousse Maracujá,Sobremesas,2.0,Natas,60,g,5
Mousse Maracujá,Sobremesas,2.0,Açúcar,20,g,5
Mini Sagres,BEBIDAS,1.2,Mini Sagres,200,ml,1
Água 0.33L,BEBIDAS,1.0,Água 0.33L,330,ml,1
Água 0.5L,BEBIDAS,1.2,Água 0.5L,500,ml,1
Compal Néctar,BEBIDAS,1.5,Compal Néctar,200,ml,1
Coca-Cola,BEBIDAS,1.5,Coca-Cola,330,ml,1
Seven Up,BEBIDAS,1.5,Seven Up,330,ml,1
Martini,Digestivos,3.0,Martini,40,ml,1
Martini Bianco,Digestivos,3.0,Martini Bianco,40,ml,1
Moscatel,Digestivos,3.0,Moscatel,40,ml,1
Vinho Tinto da casa (copo),BEBIDAS,2.5,Vinho Tinto da casa (copo),150,ml,1
Vinho Branco da casa (copo),BEBIDAS,2.5,Vinho Branco da casa (copo),150,ml,1
Whisky Novo,Digestivos,4.0,Whisky Novo,40,ml,1
Água Ardente,Digestivos,5.0,Água Ardente,40,ml,1
Gin Hendricks,Digestivos,9.0,Gin Hendricks,40,ml,1
Água c/gás,BEBIDAS,1.3,Água c/gás,250,ml,1
Vinho do Porto (dose),Digestivos,3.0,Vinho do Porto (dose),60,ml,1
Vinho do Porto Premium (dose),Digestivos,7.0,Vinho do Porto Premium (dose),60,ml,1
Nº3,Digestivos,14.0,Nº3,40,ml,1
Buldog,Digestivos,9.0,Buldog,40,ml,1
Bombay,Digestivos,5.0,Bombay,40,ml,1
Nordés,Digestivos,9.0,Nordés,40,ml,1
Gordons,Digestivos,5.0,Gordons,40,ml,1
Beirão,Digestivos,4.0,Beirão,40,ml,1
Tequilla Patrón,Digestivos,10.0,Tequilla Patrón,40,ml,1
Porto 10 anos Tawny,Digestivos,9.0,Porto 10 anos Tawny,40,ml,1
Cognac,Digestivos,8.0,Cognac,40,ml,1
Red Label,Digestivos,4.5,Red Label,40,ml,1
Jameson,Digestivos,5.0,Jameson,40,ml,1
Famous,Digestivos,4.5,Famous,40,ml,1
Black Label,Digestivos,8.0,Black Label,40,ml,1
Cardu,Digestivos,9.0,Cardu,40,ml,1
Blue Label,Digestivos,60.0,Blue Label,40,ml,1
CRF-Reserva,Digestivos,5.0,CRF-Reserva,40,ml,1
Aliança XO 10 anos,Digestivos,12.0,Aliança XO 10 anos,40,ml,1
Vinho Menu,BEBIDAS,0.79,Vinho Menu,150,ml,1
Vinho 0.5L,BEBIDAS,2.79,Vinho 0.5L,500,ml,1
Vinho 1L,BEBIDAS,1.58,Vinho 1L,1000,ml,1
Amendoa Amarga,Digestivos,3.0,Amendoa Amarga,40,ml,1
Sangria 1L,BEBIDAS,12.0,Sangria 1L,1000,ml,2
Copo 0.2L Vinho casa,S. João,1.5,Copo 0.2L Vinho casa,200,ml,1
Sangria 1.5L,BEBIDAS,17.0,Sangria 1.5L,1500,ml,2
Balantines,Digestivos,3.0,Balantines,40,ml,1
Moscatel Roxo,Digestivos,4.0,Moscatel Roxo,40,ml,1
TT A. Mayor Comendador,Garrafas,19.5,TT A. Mayor Comendador,750,ml,2
TT V.Nídeo Reserva,Garrafas,4.57,TT V.Nídeo Reserva,750,ml,2
E S.Domingos,Garrafas,6.6,E S.Domingos,750,ml,2
BR A.Mayor Comendador,Garrafas,15.0,BR A.Mayor Comendador,750,ml,2
BR Vinha Grande,Garrafas,8.79,BR Vinha Grande,750,ml,2
BR Valle do Nídeo,Garrafas,3.91,BR Valle do Nídeo,750,ml,2
BR Papa Figos,Garrafas,5.89,BR Papa Figos,750,ml,2
BR Ribeiro Santo Colheita,Garrafas,3.83,BR Ribeiro Santo Colheita,750,ml,2
TT Vinha Grande,Garrafas,8.69,TT Vinha Grande,750,ml,2
TT S. Domingos Reserva,Garrafas,6.78,TT S. Domingos Reserva,750,ml,2
TT Duvalley,Garrafas,4.8,TT Duvalley,750,ml,2
TT Papa Figos,Garrafas,5.89,TT Papa Figos,750,ml,2
Bushmills,Digestivos,8.0,Bushmills,40,ml,1
BR Duvalley,Garrafas,5.3,BR Duvalley,750,ml,2
V Muralhas,Garrafas,3.39,V Muralhas,750,ml,2
BR V. Nídeo SauvignonBlanc,Garrafas,5.5,BR V. Nídeo SauvignonBlanc,750,ml,2
BR Ribeiro Santo Encruzado,Garrafas,7.23,BR Ribeiro Santo Encruzado,750,ml,2
E Quinta Ortigão,Garrafas,6.95,E Quinta Ortigão,750,ml,2
BR Planalto,Garrafas,3.99,BR Planalto,750,ml,2
BR Volupia,Garrafas,6.45,BR Volupia,750,ml,2
TT Esteva,Garrafas,3.89,TT Esteva,750,ml,2
BR Duvalley Reserva,Garrafas,8.0,BR Duvalley Reserva,750,ml,2
BR Monte Peceguinha,Garrafas,9.99,BR Monte Peceguinha,750,ml,2
TT Monte Peceguinha,Garrafas,9.99,TT Monte Peceguinha,750,ml,2
TT S. Dom Garrafeira,Garrafas,15.0,TT S. Dom Garrafeira,750,ml,2
TT Duvalley Reserva,Garrafas,12.0,TT Duvalley Reserva,750,ml,2
S. Domingos Velhissima,Digestivos,0.75,S. Domingos Velhissima,40,ml,1
Martel,Digestivos,2.71,Martel,40,ml,1
Grand Marnier,Digestivos,1.43,Grand Marnier,40,ml,1
J&B,Digestivos,0.74,J&B,40,ml,1
ES Ortigão Nektar,Garrafas,4.39,ES Ortigão Nektar,750,ml,2
Gin Whitley Neil,Digestivos,2.05,Gin Whitley Neil,40,ml,1
Gin Paragon,Digestivos,2.28,Gin Paragon,40,ml,1
J.Walker Black 12 anos,Digestivos,2.49,J.Walker Black 12 anos,40,ml,1
Nikka,Digestivos,4.94,Nikka,40,ml,1
CRF XO RARE,Digestivos,11.89,CRF XO RARE,40,ml,1
TT Qta Portal Reserva,Garrafas,13.07,TT Qta Portal Reserva,750,ml,2
BR Qta Portal Moscatel,Garrafas,7.2,BR Qta Portal Moscatel,750,ml,2
V Regueiro,Garrafas,6.93,V Regueiro,750,ml,2
BR Qta Portal Colheita,Garrafas,7.2,BR Qta Portal Colheita,750,ml,2
TT Qta Portal Colheita,Garrafas,7.2,TT Qta Portal Colheita,750,ml,2
TT Qta Portal Grande Res.,Garrafas,26.67,TT Qta Portal Grande Res.,750,ml,2
"Vinho 1,5L",BEBIDAS,2.37,"Vinho 1,5L",1500,ml,1
TT Quinta da Leda,Garrafas,33.19,TT Quinta da Leda,750,ml,2
ES Quinta Monteirinhos,Garrafas,9.5,ES Quinta Monteirinhos,750,ml,2
TT Dez Tostões,Garrafas,10.1,TT Dez Tostões,750,ml,2
TT Liberalitas,Garrafas,10.54,TT Liberalitas,750,ml,2
BR Dona Matilde,Garrafas,6.8,BR Dona Matilde,750,ml,2
TT Dona Matilde,Garrafas,6.8,TT Dona Matilde,750,ml,2
TT Titular Colheita,Garrafas,4.68,TT Titular Colheita,750,ml,2
TT Titular Reserva,Garrafas,8.97,TT Titular Reserva,750,ml,2
BR Titular Reserva,Garrafas,8.97,BR Titular Reserva,750,ml,2
BR Titular Colheita,Garrafas,4.68,BR Titular Colheita,750,ml,2
RS Titular Rosé,Garrafas,4.68,RS Titular Rosé,750,ml,2
TT Luis Pato Touriga,Garrafas,5.29,TT Luis Pato Touriga,750,ml,2
BR Luis Pato Maria Gomes,Garrafas,4.89,BR Luis Pato Maria Gomes,750,ml,2
TT Ortigão Reserva,Garrafas,9.89,TT Ortigão Reserva,750,ml,2
BR Luis Pato Vinhas Velhas,Garrafas,7.75,BR Luis Pato Vinhas Velhas,750,ml,2
TT Galhardini,Garrafas,5.65,TT Galhardini,750,ml,2
ES Ruinnart,Garrafas,48.75,ES Ruinnart,750,ml,2
ES Deutz Extra brut,Garrafas,43.85,ES Deutz Extra brut,750,ml,2
BR Piano Moscatel Galego,Garrafas,3.99,BR Piano Moscatel Galego,750,ml,2
ES S. Domingos Extra Reserva,Garrafas,6.49,ES S. Domingos Extra Reserva,750,ml,2
TT Burmester meia gr.,Garrafas,2.32,TT Burmester meia gr.,375,ml,2
BR Burmester meia gr.,Garrafas,2.32,BR Burmester meia gr.,375,ml,2
ES Ortigão Baga,Garrafas,11.0,ES Ortigão Baga,750,ml,2
TT Ribeiro Santo colheita,Garrafas,3.83,TT Ribeiro Santo colheita,750,ml,2
TT Ribeiro Santo Res,Garrafas,5.53,TT Ribeiro Santo Res,750,ml,2
RS Papa Figos,Garrafas,5.99,RS Papa Figos,750,ml,2
ES Lagoa Velha Baga,Garrafas,12.2,ES Lagoa Velha Baga,750,ml,2
ES Lagoa Velha Bruto,Garrafas,5.5,ES Lagoa Velha Bruto,750,ml,2
BR Lagoa Velha SIngular,Garrafas,11.4,BR Lagoa Velha SIngular,750,ml,2
BR Lagoa Velha Sauvignon,Garrafas,8.55,BR Lagoa Velha Sauvignon,750,ml,2
BR Lagoa Velha Chardonay,Garrafas,8.55,BR Lagoa Velha Chardonay,750,ml,2
TT Pago de Carraovejas,Garrafas,35.39,TT Pago de Carraovejas,750,ml,2
BR GALHARDINI,Garrafas,4.14,BR GALHARDINI,750,ml,2
BR M. Daniel Talhas,Garrafas,14.42,BR M. Daniel Talhas,750,ml,2
TT M. Daniel Talhas,Garrafas,14.42,TT M. Daniel Talhas,750,ml,2
TT H. Grous,Garrafas,9.09,TT H. Grous,750,ml,2
BR H. Grous,Garrafas,9.09,BR H. Grous,750,ml,2
BR Pera Manca,Garrafas,58.5,BR Pera Manca,750,ml,2
TT Dona Matilde Res,Garrafas,15.95,TT Dona Matilde Res,750,ml,2
BR TERRAS DO GRIFO RES,Garrafas,9.74,BR TERRAS DO GRIFO RES,750,ml,2
TT QUINTA VENTOZELO,Garrafas,10.49,TT QUINTA VENTOZELO,750,ml,2
BR Qta Lemos D.Santana,Garrafas,12.9,BR Qta Lemos D.Santana,750,ml,2
TT Qta Lemos D.Santana,Garrafas,12.0,TT Qta Lemos D.Santana,750,ml,2
BR Qta Lemos D.Paulette,Garrafas,25.9,BR Qta Lemos D.Paulette,750,ml,2
ES Qta Poço Chardonay,Garrafas,8.54,ES Qta Poço Chardonay,750,ml,2
ES Qta Poço Baga,Garrafas,8.54,ES Qta Poço Baga,750,ml,2
BR Qta. Boa Esperança,Garrafas,5.49,BR Qta. Boa Esperança,750,ml,2
RS Qta. Boa Esperança,Garrafas,5.49,RS Qta. Boa Esperança,750,ml,2
RS Qta. Boa Esperança Atlantico,Garrafas,9.95,RS Qta. Boa Esperança Atlantico,750,ml,2
TT Qta. Boa Esperança Grande Res.,Garrafas,30.0,TT Qta. Boa Esperança Grande Res.,750,ml,2`;
const SALES_CSV_RAW = `dish,quantity,date
BR Qta Lemos D.Paulette,1.0,2026-01-05
Bacalhau à Brás,1.0,2026-01-05
Bacalhau à Lagareiro,1.0,2026-01-05
Bebida Dia,14.0,2026-01-05
Café,6.0,2026-01-05
Couvert,4.0,2026-01-05
Doce da casa,1.0,2026-01-05
Fino,3.0,2026-01-05
Menu Dia,7.0,2026-01-05
Mouse,1.0,2026-01-05
Pera Bêbada,3.0,2026-01-05
Prato do dia Carne,6.0,2026-01-05
Prato do dia Peixe,8.0,2026-01-05
TT Ribeiro Santo Res,1.0,2026-01-05
Vegetariano,1.0,2026-01-05
Vinho 0.5L,2.0,2026-01-05
BR Papa Figos,1.0,2026-01-06
Bacalhau à Lagareiro,1.0,2026-01-06
Batata dose,1.0,2026-01-06
Bebida Dia,12.0,2026-01-06
Bife de Atum,1.0,2026-01-06
Café,7.0,2026-01-06
Camarão costa (Peq.),1.0,2026-01-06
Carne de Porco à Alentejana,1.0,2026-01-06
Cataplana de Peixe 2Pax,1.0,2026-01-06
Couvert,2.0,2026-01-06
Filetes Peixe Galo,2.0,2026-01-06
Ice Tea,1.0,2026-01-06
Magret de Pato,1.0,2026-01-06
Menu 25€,8.0,2026-01-06
Menu Degustação Simples,16.0,2026-01-06
Menu Dia,6.0,2026-01-06
Ovos Rotos,1.0,2026-01-06
Picanha,1.0,2026-01-06
Posta,1.0,2026-01-06
Prato do dia Carne,2.0,2026-01-06
Prato do dia Peixe,10.0,2026-01-06
Pudim,2.0,2026-01-06
Queijo Couvert,1.0,2026-01-06
Salada,1.0,2026-01-06
Sopa,3.0,2026-01-06
Take Away,2.0,2026-01-06
V Muralhas,1.0,2026-01-06
Vegetariano,1.0,2026-01-06
Vinho 0.5L,3.0,2026-01-06
Vinho Menu,16.0,2026-01-06
Vinho Tinto da casa (copo),1.0,2026-01-06
Água 0.5L,3.0,2026-01-06
Arroz de Tamboril,2.0,2026-01-07
BR Luis Pato Maria Gomes,1.0,2026-01-07
Bebida Dia,26.0,2026-01-07
Bife Lombo,1.0,2026-01-07
Café,24.0,2026-01-07
Camarao ao alho,1.0,2026-01-07
Carne de Porco à Alentejana,2.0,2026-01-07
Cerveja S/Alcool,1.0,2026-01-07
Cesto de Pão,1.0,2026-01-07
Coca-Cola,1.0,2026-01-07
Couvert,8.0,2026-01-07
Delicia de Chocolate,3.0,2026-01-07
Doce da casa,6.0,2026-01-07
Filetes Peixe Galo,11.5,2026-01-07
Filetes de Polvo,3.5,2026-01-07
Fino,1.0,2026-01-07
Fruta,2.0,2026-01-07
Ice Tea,1.0,2026-01-07
Maça Assada,1.0,2026-01-07
Menu Dia,31.0,2026-01-07
"Menu Dia,Prato do dia Carne,Bebida Dia",1.0,2026-01-07
Mouse,1.0,2026-01-07
Pera Bêbada,1.0,2026-01-07
Polvo à Lagareiro,1.0,2026-01-07
Prato do dia Carne,18.0,2026-01-07
Prato do dia Peixe,14.0,2026-01-07
Pudim,2.0,2026-01-07
Seven Up,1.0,2026-01-07
Sopa,1.0,2026-01-07
Sopa de Marisco,1.0,2026-01-07
Sopa de Peixe,2.0,2026-01-07
TT Ribeiro Santo Res,3.0,2026-01-07
Take Away,4.0,2026-01-07
Tostas de Rabo de Boi,2.0,2026-01-07
Vegetariano,1.0,2026-01-07
Vinho 0.5L,1.0,2026-01-07
Vinho Branco da casa (copo),1.0,2026-01-07
Vinho Tinto da casa (copo),1.0,2026-01-07
Água 0.5L,1.0,2026-01-07
Água Menu,6.0,2026-01-07
Água c/gás,2.0,2026-01-07
Ameijoas à Bulhão Pato,1.0,2026-01-08
Arroz de Polvo,1.0,2026-01-08
Bebida Dia,10.0,2026-01-08
Bife Lombo,2.0,2026-01-08
Bife de Atum,1.0,2026-01-08
Café,23.0,2026-01-08
Caldo Verde,1.0,2026-01-08
Carne de Porco à Alentejana,3.0,2026-01-08
Coca-Cola,2.0,2026-01-08
Couvert,10.0,2026-01-08
Delicia de Chocolate,1.0,2026-01-08
Doce da casa,1.0,2026-01-08
Entrecôte,3.0,2026-01-08
Filetes Peixe Galo,6.0,2026-01-08
Fino,1.0,2026-01-08
Legumes Salteados,1.0,2026-01-08
Magret de Pato,1.0,2026-01-08
Martini Bianco,1.0,2026-01-08
Menu Dia,12.0,2026-01-08
Mouse,1.0,2026-01-08
Ovos Rotos,2.0,2026-01-08
Pera Bêbada,3.0,2026-01-08
Prato do dia Carne,10.0,2026-01-08
Prato do dia Peixe,14.0,2026-01-08
Pudim,2.0,2026-01-08
Queijo Couvert,1.0,2026-01-08
Sangria 1.5L,2.0,2026-01-08
Sopa de Marisco,1.0,2026-01-08
Sopa de Peixe,2.0,2026-01-08
Take Away,2.0,2026-01-08
V Muralhas,1.0,2026-01-08
Vinho 0.5L,8.0,2026-01-08
Vinho Branco da casa (copo),1.0,2026-01-08
Vinho Tinto da casa (copo),1.0,2026-01-08
Água 0.33L,1.0,2026-01-08
Água 0.5L,2.0,2026-01-08
Água Ardente,2.0,2026-01-08
Água Menu,14.0,2026-01-08
Água c/gás,1.0,2026-01-08
Arroz de Rabo de Boi,3.0,2026-01-09
Arroz de Tamboril,1.0,2026-01-09
BR GALHARDINI,1.0,2026-01-09
BR Qta Portal Moscatel,1.0,2026-01-09
Bacalhau à Brás,1.0,2026-01-09
Bebida Dia,22.0,2026-01-09
Beirão,1.0,2026-01-09
CRF-Reserva,1.0,2026-01-09
Café,60.0,2026-01-09
Carne de Porco à Alentejana,2.0,2026-01-09
Coca-Cola,4.0,2026-01-09
Couvert,7.0,2026-01-09
Doce da casa,4.0,2026-01-09
Entrecôte,1.0,2026-01-09
Filetes Peixe Galo,5.0,2026-01-09
Filetes de Polvo,1.0,2026-01-09
Fino,14.0,2026-01-09
Jameson,1.0,2026-01-09
Maça Assada,2.0,2026-01-09
Menu 35€,23.0,2026-01-09
"Menu 35€,Menu 35€,Vinho Menu,Café",8.0,2026-01-09
Menu Dia,18.65,2026-01-09
"Menu Dia,Prato do dia Carne,Bebida Dia",1.34,2026-01-09
"Menu Dia,Prato do dia Peixe,Bebida Dia",2.01,2026-01-09
Mini Sagres,18.0,2026-01-09
Mouse,7.0,2026-01-09
Pera Bêbada,2.0,2026-01-09
Polvo à Lagareiro,1.0,2026-01-09
Prato do dia Carne,8.0,2026-01-09
Prato do dia Peixe,14.0,2026-01-09
Prego,1.0,2026-01-09
Pudim,1.0,2026-01-09
Sangria 1L,1.0,2026-01-09
Sopa de Peixe,8.0,2026-01-09
Take Away,2.0,2026-01-09
Tostas de Rabo de Boi,5.0,2026-01-09
Vinho 0.5L,2.0,2026-01-09
Vinho Menu,16.0,2026-01-09
Vinho do Porto (dose),3.0,2026-01-09
Água 0.5L,1.0,2026-01-09
Água Ardente,4.0,2026-01-09
Ameijoas à Bulhão Pato,2.0,2026-01-10
Arroz de Tamboril,3.0,2026-01-10
Azeitonas,1.0,2026-01-10
BR Papa Figos,1.0,2026-01-10
BR Ribeiro Santo Encruzado,1.0,2026-01-10
BR Valle do Nídeo,1.0,2026-01-10
Bacalhau à Narcisa,2.0,2026-01-10
Bolinhas Alheira (6 Un.),4.0,2026-01-10
Café,34.0,2026-01-10
Caldo Verde,3.0,2026-01-10
Carne de Porco à Alentejana,1.0,2026-01-10
Cesto de Pão,1.0,2026-01-10
Chá,1.0,2026-01-10
Coca-Cola,3.0,2026-01-10
Couvert,14.0,2026-01-10
Cozido à Portuguesa,11.0,2026-01-10
Doce da casa,8.0,2026-01-10
Entrecôte,6.0,2026-01-10
Filetes Peixe Galo,12.0,2026-01-10
Filetes de Polvo,4.0,2026-01-10
Fino,13.0,2026-01-10
Fruta Tropical,1.0,2026-01-10
Magret de Pato,2.0,2026-01-10
Maça Assada,5.0,2026-01-10
Melão com Presunto,4.0,2026-01-10
Mini Sagres,2.0,2026-01-10
Mouse,4.0,2026-01-10
Pera Bêbada,3.0,2026-01-10
Polvo Ensalsado,1.0,2026-01-10
Pudim,1.0,2026-01-10
Queijo Couvert,2.0,2026-01-10
RS Papa Figos,1.0,2026-01-10
Salada,2.0,2026-01-10
Sandwich Club,2.0,2026-01-10
Seven Up,1.0,2026-01-10
Sopa,1.0,2026-01-10
Sopa de Peixe,12.0,2026-01-10
TT V.Nídeo Reserva,5.0,2026-01-10
Take Away,3.0,2026-01-10
Taça de Gelado,1.0,2026-01-10
Tostas de Rabo de Boi,7.0,2026-01-10
Vinho 0.5L,7.0,2026-01-10
Vinho 1L,2.0,2026-01-10
Água 0.5L,15.0,2026-01-10
Água c/gás,1.0,2026-01-10
Ameijoas à Bulhão Pato,1.0,2026-01-12
BR Monte Peceguinha,1.0,2026-01-12
BR Vinha Grande,1.0,2026-01-12
BR Volupia,1.0,2026-01-12
Bacalhau à Brás,1.0,2026-01-12
Bebida Dia,42.0,2026-01-12
Bife de Atum,1.0,2026-01-12
Bolinhas de Alheira (3 Un.),1.0,2026-01-12
Café,27.0,2026-01-12
Camarão da Costa,1.0,2026-01-12
Coca-Cola,2.0,2026-01-12
Compal Néctar,2.0,2026-01-12
Couvert,14.0,2026-01-12
Doce da casa,2.0,2026-01-12
Entrecôte,1.0,2026-01-12
Filetes Peixe Galo,12.5,2026-01-12
Filetes de Polvo,13.0,2026-01-12
Fino,1.0,2026-01-12
Fruta Tropical,2.0,2026-01-12
Gin Hendricks,1.0,2026-01-12
Ice Tea,1.0,2026-01-12
Maça Assada,5.0,2026-01-12
Menu Dia,47.0,2026-01-12
"Menu Dia,Prato do dia Carne,Bebida Dia",1.0,2026-01-12
Mouse,2.0,2026-01-12
Pera Bêbada,3.0,2026-01-12
Pica-pau,1.0,2026-01-12
Posta,1.0,2026-01-12
Prato do dia Carne,24.0,2026-01-12
Prato do dia Peixe,24.0,2026-01-12
Take Away,3.0,2026-01-12
Tostas de Rabo de Boi,2.0,2026-01-12
Vinho 0.5L,4.0,2026-01-12
Vinho Branco da casa (copo),1.0,2026-01-12
Água 0.5L,2.0,2026-01-12
Água Menu,6.0,2026-01-12
Água c/gás,5.0,2026-01-12
Arroz dose,1.0,2026-01-13
Azeitonas,1.0,2026-01-13
Bebida Dia,32.0,2026-01-13
Café,18.0,2026-01-13
Camarão da Costa,1.0,2026-01-13
Cerveja S/Alcool,1.0,2026-01-13
Coca-Cola,1.0,2026-01-13
Couvert,8.0,2026-01-13
Doce da casa,1.0,2026-01-13
Entrecôte,3.0,2026-01-13
Filetes Peixe Galo,1.0,2026-01-13
Filetes de Polvo,1.0,2026-01-13
Fino,6.0,2026-01-13
Menu 25€,3.0,2026-01-13
"Menu 25€,Menu Degustação Simples,Vinho Menu",5.0,2026-01-13
Menu Degustação Simples,8.0,2026-01-13
Menu Dia,18.0,2026-01-13
Mouse,1.0,2026-01-13
Ovos Rotos,1.0,2026-01-13
Pera Bêbada,2.0,2026-01-13
Picanha,1.0,2026-01-13
Polvo à Lagareiro,1.0,2026-01-13
Prato do dia Carne,4.0,2026-01-13
Prato do dia Peixe,32.0,2026-01-13
Salada,1.0,2026-01-13
Take Away,1.0,2026-01-13
Vinho 0.5L,3.0,2026-01-13
Vinho 1L,1.0,2026-01-13
Vinho Branco da casa (copo),2.0,2026-01-13
Vinho Menu,8.0,2026-01-13
Água 0.5L,1.0,2026-01-13
Água Menu,4.0,2026-01-13
Ameijoas à Bulhão Pato,1.0,2026-01-14
Azeitonas,1.0,2026-01-14
BR Ribeiro Santo Encruzado,1.0,2026-01-14
Bebida Dia,26.0,2026-01-14
Bolinhas de Alheira (3 Un.),1.0,2026-01-14
Café,20.0,2026-01-14
Camarao ao alho,3.0,2026-01-14
Cerveja S/Alcool,1.0,2026-01-14
Coca-Cola,4.0,2026-01-14
Compal Néctar,2.0,2026-01-14
Couvert,11.0,2026-01-14
Doce da casa,2.0,2026-01-14
ES S. Domingos Extra Reserva,2.0,2026-01-14
Filetes Peixe Galo,7.5,2026-01-14
Filetes de Polvo,1.0,2026-01-14
Fino,5.0,2026-01-14
Fruta,1.0,2026-01-14
Ice Tea,1.0,2026-01-14
Jameson,2.0,2026-01-14
Magret de Pato,1.0,2026-01-14
Maça Assada,3.0,2026-01-14
Menu Dia,17.0,2026-01-14
Mouse,1.0,2026-01-14
Pica-Pau Terra e Mar,1.0,2026-01-14
Picanha,3.0,2026-01-14
Polvo à Lagareiro,2.0,2026-01-14
Prato do dia Carne,6.0,2026-01-14
Prato do dia Peixe,28.0,2026-01-14
Salada,1.0,2026-01-14
Sandwich Club,2.0,2026-01-14
Sopa de Peixe,6.0,2026-01-14
Take Away,2.0,2026-01-14
Tostas de Rabo de Boi,3.0,2026-01-14
Vinho 0.5L,1.0,2026-01-14
Vinho Branco da casa (copo),1.0,2026-01-14
Água 0.5L,3.0,2026-01-14
Água Menu,8.0,2026-01-14
Água c/gás,1.0,2026-01-14
Ameijoas à Bulhão Pato,1.0,2026-01-15
Amendoa Amarga,2.0,2026-01-15
Arroz de Polvo,3.0,2026-01-15
Arroz de Rabo de Boi,3.0,2026-01-15
Bacalhau à Brás,1.0,2026-01-15
Bacalhau à Lagareiro,1.0,2026-01-15
Bebida Dia,18.0,2026-01-15
Black Label,7.0,2026-01-15
Bolinhas de Alheira (3 Un.),1.0,2026-01-15
Café,22.0,2026-01-15
Caldo Verde,1.0,2026-01-15
Camarão da Costa,1.0,2026-01-15
Carne de Porco à Alentejana,1.0,2026-01-15
Cesto de Pão,1.0,2026-01-15
Coca-Cola,3.0,2026-01-15
Couvert,10.0,2026-01-15
Doce da casa,2.0,2026-01-15
Filetes Peixe Galo,6.0,2026-01-15
Filetes de Polvo,2.0,2026-01-15
Fino,5.0,2026-01-15
Maça Assada,3.0,2026-01-15
Menu Dia,11.0,2026-01-15
Mini Sagres,6.0,2026-01-15
Mouse,5.0,2026-01-15
Pera Bêbada,6.0,2026-01-15
Picanha,2.0,2026-01-15
Prato do dia Carne,12.0,2026-01-15
Prato do dia Peixe,10.0,2026-01-15
Pudim,1.0,2026-01-15
Queijo Couvert,2.0,2026-01-15
Sopa de Peixe,4.0,2026-01-15
TT Galhardini,3.0,2026-01-15
Take Away,1.0,2026-01-15
Tostas de Rabo de Boi,3.0,2026-01-15
Vinho 0.5L,2.0,2026-01-15
Vinho 1L,4.0,2026-01-15
Vinho Tinto da casa (copo),1.0,2026-01-15
Água 0.5L,5.0,2026-01-15
Água Menu,4.0,2026-01-15
Água c/gás,1.0,2026-01-15
Azeitonas,1.0,2026-01-16
Bacalhau à Brás,1.0,2026-01-16
Bebida Dia,8.0,2026-01-16
Bife Lombo,2.0,2026-01-16
Café,12.0,2026-01-16
Camarao ao alho,1.0,2026-01-16
Coca-Cola,7.0,2026-01-16
Couvert,7.0,2026-01-16
Doce da casa,3.0,2026-01-16
ES S. Domingos Extra Reserva,2.0,2026-01-16
Entrecôte,1.0,2026-01-16
Filetes Peixe Galo,21.0,2026-01-16
Filetes de Polvo,9.5,2026-01-16
Fino,1.0,2026-01-16
Menu Dia,7.66,2026-01-16
Mouse,5.0,2026-01-16
Pera Bêbada,3.0,2026-01-16
Posta,1.0,2026-01-16
Prato do dia Carne,2.0,2026-01-16
Prato do dia Peixe,6.0,2026-01-16
Pudim,1.0,2026-01-16
Salada,1.0,2026-01-16
Sopa,1.0,2026-01-16
Sopa de Peixe,1.0,2026-01-16
TT V.Nídeo Reserva,1.0,2026-01-16
Take Away,2.0,2026-01-16
Tostas de Rabo de Boi,7.0,2026-01-16
Vinho 0.5L,2.0,2026-01-16
Vinho Branco da casa (copo),1.0,2026-01-16
Água 0.5L,2.0,2026-01-16
Alheira,1.0,2026-01-17
Arroz de Rabo de Boi,2.0,2026-01-17
Arroz de Tamboril,1.0,2026-01-17
Bacalhau à Brás,3.0,2026-01-17
Bacalhau à Narcisa,3.0,2026-01-17
Batata dose,1.0,2026-01-17
Bebida Dia,4.0,2026-01-17
Bife Lombo,1.0,2026-01-17
Bife de Atum,1.0,2026-01-17
Bolinhas de Alheira (3 Un.),1.0,2026-01-17
Café,33.0,2026-01-17
Carne de Porco à Alentejana,4.0,2026-01-17
Coca-Cola,5.0,2026-01-17
Couvert,14.0,2026-01-17
Coxa de Pato Confitada,1.0,2026-01-17
Cozido à Portuguesa,6.0,2026-01-17
Doce da casa,8.0,2026-01-17
Dourada/Robalo Grelhado,3.0,2026-01-17
Filetes Peixe Galo,33.0,2026-01-17
Filetes de Polvo,9.0,2026-01-17
Fino,7.0,2026-01-17
Gin Hendricks,1.0,2026-01-17
Magret de Pato,1.0,2026-01-17
Maça Assada,2.0,2026-01-17
Menu Dia,3.0,2026-01-17
Mouse,9.0,2026-01-17
Omelete Camarão,2.0,2026-01-17
Ovos Rotos,3.0,2026-01-17
Picanha,1.0,2026-01-17
Polvo à Lagareiro,2.0,2026-01-17
Prato do dia Carne,6.0,2026-01-17
Prego,1.0,2026-01-17
Pudim,3.0,2026-01-17
Sangria 1.5L,5.0,2026-01-17
Sangria Espumante 1.5L,3.0,2026-01-17
Sopa,4.0,2026-01-17
Sopa de Marisco,2.0,2026-01-17
Sopa de Peixe,7.0,2026-01-17
TT Duvalley Reserva,3.0,2026-01-17
TT Galhardini,1.0,2026-01-17
TT V.Nídeo Reserva,1.0,2026-01-17
Take Away,2.0,2026-01-17
Tostas de Rabo de Boi,4.0,2026-01-17
Vegetariano,1.0,2026-01-17
Vinho 0.5L,1.0,2026-01-17
Vinho 1L,1.0,2026-01-17
Vinho Branco da casa (copo),1.0,2026-01-17
Vinho Tinto da casa (copo),1.0,2026-01-17
Água 0.5L,15.0,2026-01-17
Água Menu,2.0,2026-01-17
Água c/gás,2.0,2026-01-17
Alheira,1.0,2026-01-19
Ameijoas à Bulhão Pato,1.0,2026-01-19
Arroz de Tamboril,1.0,2026-01-19
BR Monte Peceguinha,2.0,2026-01-19
Bacalhau à Brás,1.0,2026-01-19
Bebida Dia,20.0,2026-01-19
Bife Lombo,2.0,2026-01-19
Bife de Atum,1.0,2026-01-19
Café,20.0,2026-01-19
Caldo Verde,4.0,2026-01-19
Camarao ao alho,1.0,2026-01-19
Carne de Porco à Alentejana,1.0,2026-01-19
Cesto de Pão,1.0,2026-01-19
Chá,2.0,2026-01-19
Coca-Cola,4.0,2026-01-19
Couvert,7.0,2026-01-19
Delicia de Chocolate,3.0,2026-01-19
Doce da casa,1.0,2026-01-19
Entrecôte,2.0,2026-01-19
Filetes Peixe Galo,5.0,2026-01-19
Fino,2.0,2026-01-19
Ice Tea,1.0,2026-01-19
Menu Dia,11.0,2026-01-19
Mouse,2.0,2026-01-19
Ovos Rotos,1.0,2026-01-19
Posta,1.0,2026-01-19
Prato do dia Carne,8.0,2026-01-19
Prato do dia Peixe,14.0,2026-01-19
Sopa,3.0,2026-01-19
Take Away,5.0,2026-01-19
Tostas de Rabo de Boi,1.0,2026-01-19
Vegetariano,2.0,2026-01-19
Vinho 0.5L,2.0,2026-01-19
Vinho Branco da casa (copo),2.0,2026-01-19
Água 0.5L,8.0,2026-01-19
Água Menu,2.0,2026-01-19
Água c/gás,3.0,2026-01-19
Arroz de Tamboril,1.0,2026-01-20
Bebida Dia,10.0,2026-01-20
Beirão,4.0,2026-01-20
Café,2.0,2026-01-20
Cesto de Pão,1.0,2026-01-20
Couvert,2.0,2026-01-20
Filetes Peixe Galo,1.0,2026-01-20
Maça Assada,5.0,2026-01-20
Menu 25€,5.0,2026-01-20
Menu Degustação Simples,10.0,2026-01-20
Menu Dia,7.0,2026-01-20
Ovos Rotos,1.0,2026-01-20
Pera Bêbada,2.0,2026-01-20
Prato do dia Carne,8.0,2026-01-20
Prato do dia Peixe,6.0,2026-01-20
Pudim,1.0,2026-01-20
Sopa,1.0,2026-01-20
Sopa de Peixe,1.0,2026-01-20
Take Away,2.0,2026-01-20
V Muralhas,1.0,2026-01-20
Vinho Menu,10.0,2026-01-20
Água Menu,4.0,2026-01-20
Ameijoas à Bulhão Pato,1.0,2026-01-21
Azeitonas,2.0,2026-01-21
BR Ribeiro Santo Colheita,1.0,2026-01-21
Bebida Dia,34.0,2026-01-21
Café,16.0,2026-01-21
Cesto de Pão,2.0,2026-01-21
Chá,1.0,2026-01-21
Couvert,3.0,2026-01-21
Delicia de Chocolate,1.0,2026-01-21
Menu Dia,29.81,2026-01-21
"Menu Dia,Prato do dia Carne,Bebida Dia",1.68,2026-01-21
"Menu Dia,Prato do dia Peixe,Bebida Dia",2.52,2026-01-21
Mouse,4.0,2026-01-21
Pera Bêbada,2.0,2026-01-21
Prato do dia Carne,24.0,2026-01-21
Prato do dia Peixe,10.0,2026-01-21
Pudim,1.0,2026-01-21
Queijo Couvert,4.0,2026-01-21
TT A. Mayor Comendador,2.0,2026-01-21
TT Esteva,1.0,2026-01-21
Take Away,1.0,2026-01-21
Tostas de Rabo de Boi,3.0,2026-01-21
Vinho 0.5L,3.0,2026-01-21
Água 0.5L,1.0,2026-01-21
Ameijoas à Bulhão Pato,1.0,2026-01-22
Bacalhau à Brás,1.0,2026-01-22
Bacalhau à Lagareiro,1.0,2026-01-22
Bebida Dia,2.0,2026-01-22
CRF-Reserva,1.0,2026-01-22
Café,14.0,2026-01-22
Caldo Verde,2.0,2026-01-22
Camarao ao alho,1.0,2026-01-22
Carne de Porco à Alentejana,1.0,2026-01-22
Cesto de Pão,2.0,2026-01-22
Coca-Cola,4.0,2026-01-22
Couvert,8.0,2026-01-22
Doce da casa,3.0,2026-01-22
Dourada/Robalo Grelhado,1.0,2026-01-22
Entrecôte,1.0,2026-01-22
Filetes Peixe Galo,2.0,2026-01-22
Filetes de Polvo,1.0,2026-01-22
Magret de Pato,3.0,2026-01-22
Menu Dia,9.0,2026-01-22
Mouse,3.0,2026-01-22
Omelete Camarão,1.0,2026-01-22
Pera Bêbada,3.0,2026-01-22
Posta,3.0,2026-01-22
Prato do dia Carne,8.0,2026-01-22
Prato do dia Peixe,10.0,2026-01-22
Pudim,4.0,2026-01-22
Sangria 1.5L,1.0,2026-01-22
Sopa,3.0,2026-01-22
TT Duvalley,1.0,2026-01-22
Take Away,1.0,2026-01-22
Vinho 0.5L,1.0,2026-01-22
Vinho 1L,1.0,2026-01-22
Vinho Branco da casa (copo),2.0,2026-01-22
Vinho Tinto da casa (copo),1.0,2026-01-22
Água 0.5L,1.0,2026-01-22
Água Menu,16.0,2026-01-22
Água c/gás,3.0,2026-01-22
Ameijoas à Bulhão Pato,2.0,2026-01-23
Arroz de Polvo,1.0,2026-01-23
Arroz de Rabo de Boi,1.0,2026-01-23
Arroz de Tamboril,3.0,2026-01-23
Azeitonas,1.0,2026-01-23
BR Burmester meia gr.,1.0,2026-01-23
Bacalhau à Brás,1.0,2026-01-23
Bebida Dia,38.0,2026-01-23
Bife Lombo,1.0,2026-01-23
Bolinhas Alheira (6 Un.),1.0,2026-01-23
Bolinhas de Alheira (3 Un.),1.0,2026-01-23
Café,25.0,2026-01-23
Carne de Porco à Alentejana,1.0,2026-01-23
Coca-Cola,3.0,2026-01-23
Compal Néctar,2.0,2026-01-23
Couvert,14.0,2026-01-23
Doce da casa,3.0,2026-01-23
Filetes Peixe Galo,4.0,2026-01-23
Filetes de Polvo,2.0,2026-01-23
Fino,5.0,2026-01-23
Fruta,1.0,2026-01-23
Maça Assada,4.0,2026-01-23
Menu Dia,32.86,2026-01-23
"Menu Dia,Prato do dia Carne,Bebida Dia",9.14,2026-01-23
Mouse,9.0,2026-01-23
Ovos Rotos,2.0,2026-01-23
Pera Bêbada,4.0,2026-01-23
Polvo à Lagareiro,1.0,2026-01-23
Prato do dia Carne,30.0,2026-01-23
Prato do dia Peixe,12.0,2026-01-23
Queijo Couvert,4.0,2026-01-23
Sopa,1.0,2026-01-23
Sopa de Peixe,4.0,2026-01-23
TT Ribeiro Santo Res,2.0,2026-01-23
Take Away,5.0,2026-01-23
Tostas de Rabo de Boi,2.0,2026-01-23
V Muralhas,1.0,2026-01-23
Vinho 0.5L,3.0,2026-01-23
Vinho Tinto da casa (copo),1.0,2026-01-23
Água 0.5L,4.0,2026-01-23
Água Menu,4.0,2026-01-23
Água c/gás,5.0,2026-01-23
Alheira,1.0,2026-01-24
Ameijoas à Bulhão Pato,1.0,2026-01-24
Arroz de Rabo de Boi,1.0,2026-01-24
Arroz de Tamboril,1.0,2026-01-24
BR Luis Pato Maria Gomes,1.0,2026-01-24
Bacalhau à Brás,1.0,2026-01-24
Bacalhau à Narcisa,4.0,2026-01-24
Bolinhas de Alheira (3 Un.),1.0,2026-01-24
CRF-Reserva,1.0,2026-01-24
Café,15.0,2026-01-24
Caldo Verde,1.0,2026-01-24
Carne de Porco à Alentejana,1.0,2026-01-24
Cesto de Pão,1.0,2026-01-24
Coca-Cola,4.0,2026-01-24
Couvert,10.0,2026-01-24
Coxa de Pato Confitada,1.0,2026-01-24
Cozido à Portuguesa,3.0,2026-01-24
Doce da casa,2.0,2026-01-24
ES S. Domingos Extra Reserva,1.0,2026-01-24
Entrecôte,3.0,2026-01-24
Filetes Peixe Galo,9.0,2026-01-24
Filetes de Polvo,2.0,2026-01-24
Fino,14.0,2026-01-24
Jameson,1.0,2026-01-24
Maça Assada,1.0,2026-01-24
Menu Dia,1.0,2026-01-24
Mouse,1.0,2026-01-24
Pera Bêbada,1.0,2026-01-24
Pica-Pau Terra e Mar,1.0,2026-01-24
Pica-pau,1.0,2026-01-24
Prato do dia Peixe,2.0,2026-01-24
Pudim,1.0,2026-01-24
Queijo Couvert,1.0,2026-01-24
Sopa,5.0,2026-01-24
Sopa de Peixe,3.0,2026-01-24
TT Duvalley,3.0,2026-01-24
TT Duvalley Reserva,2.0,2026-01-24
Take Away,4.0,2026-01-24
Taça de Gelado,1.0,2026-01-24
Tostas de Rabo de Boi,6.0,2026-01-24
Vinho 0.5L,2.0,2026-01-24
Vinho 1L,4.0,2026-01-24
Vinho Branco da casa (copo),2.0,2026-01-24
Vinho Tinto da casa (copo),1.0,2026-01-24
Água 0.5L,8.0,2026-01-24
Água Menu,2.0,2026-01-24
Água c/gás,4.0,2026-01-24
Alheira,1.0,2026-01-26
Azeitonas,1.0,2026-01-26
Bebida Dia,8.0,2026-01-26
Café,9.0,2026-01-26
Caldo Verde,1.0,2026-01-26
Camarao ao alho,1.0,2026-01-26
Cerveja S/Alcool,1.0,2026-01-26
Cesto de Pão,1.0,2026-01-26
Chouriço Assado,1.0,2026-01-26
Coca-Cola,1.0,2026-01-26
Compal Néctar,2.0,2026-01-26
Couvert,7.0,2026-01-26
Doce da casa,2.0,2026-01-26
Dourada/Robalo Grelhado,1.0,2026-01-26
Filetes Peixe Galo,18.5,2026-01-26
Filetes de Polvo,4.0,2026-01-26
Fruta Tropical,1.0,2026-01-26
Ice Tea,1.0,2026-01-26
Menu Dia,7.0,2026-01-26
Mini Sagres,1.0,2026-01-26
Mouse,2.0,2026-01-26
Ovos Rotos,1.0,2026-01-26
Pera Bêbada,1.0,2026-01-26
Picanha,1.0,2026-01-26
Prato do dia Carne,8.0,2026-01-26
Prato do dia Peixe,6.0,2026-01-26
Prego,1.0,2026-01-26
Pudim,1.0,2026-01-26
Queijo Couvert,1.0,2026-01-26
Sangria Espumante 1.5L,1.0,2026-01-26
Sopa,2.0,2026-01-26
Sopa de Peixe,1.0,2026-01-26
TT Galhardini,1.0,2026-01-26
TT Ribeiro Santo Res,1.0,2026-01-26
Take Away,4.0,2026-01-26
Tostas de Rabo de Boi,1.0,2026-01-26
Vinho 0.5L,3.0,2026-01-26
Vinho Branco da casa (copo),2.0,2026-01-26
Vinho Tinto da casa (copo),1.0,2026-01-26
Água 0.5L,3.0,2026-01-26
Água Menu,6.0,2026-01-26
Água c/gás,1.0,2026-01-26
Ameijoas à Bulhão Pato,1.0,2026-01-27
Arroz de Polvo,1.0,2026-01-27
Arroz de Rabo de Boi,1.0,2026-01-27
Azeitonas,1.0,2026-01-27
BR Duvalley Reserva,1.0,2026-01-27
Bebida Dia,20.0,2026-01-27
CRF-Reserva,2.0,2026-01-27
Café,19.0,2026-01-27
Carne de Porco à Alentejana,2.0,2026-01-27
Coca-Cola,1.0,2026-01-27
Compal Néctar,2.28,2026-01-27
Couvert,10.52,2026-01-27
Doce da casa,4.0,2026-01-27
Filetes Peixe Galo,9.0,2026-01-27
Filetes de Polvo,2.52,2026-01-27
Fino,1.0,2026-01-27
Ice Tea,1.52,2026-01-27
Menu 25€,7.11,2026-01-27
"Menu 25€,Menu Degustação Simples,Vinho Menu",8.11,2026-01-27
Menu Degustação Simples,16.22,2026-01-27
Menu Dia,12.0,2026-01-27
Mouse,1.0,2026-01-27
Ovos Rotos,1.0,2026-01-27
Pera Bêbada,2.0,2026-01-27
Picanha,2.0,2026-01-27
Prato do dia Carne,10.0,2026-01-27
Prato do dia Peixe,14.0,2026-01-27
Queijo Couvert,2.0,2026-01-27
Sopa,2.0,2026-01-27
Sopa de Peixe,2.0,2026-01-27
TT Monte Peceguinha,1.0,2026-01-27
Take Away,8.0,2026-01-27
Vinho 0.5L,3.0,2026-01-27
Vinho Menu,16.22,2026-01-27
Água 0.5L,7.52,2026-01-27
Água Menu,4.0,2026-01-27
Arroz de Rabo de Boi,1.0,2026-01-28
BR Ribeiro Santo Encruzado,1.0,2026-01-28
Bacalhau à Lagareiro,1.0,2026-01-28
Bebida Dia,24.0,2026-01-28
Beirão,4.0,2026-01-28
Bife de Atum,1.0,2026-01-28
Bolinhas Alheira (6 Un.),1.0,2026-01-28
Café,17.0,2026-01-28
Carne de Porco à Alentejana,5.0,2026-01-28
Chá,1.0,2026-01-28
Coca-Cola,1.0,2026-01-28
Couvert,8.0,2026-01-28
Delicia de Chocolate,3.0,2026-01-28
Doce da casa,1.0,2026-01-28
Entrecôte,1.0,2026-01-28
Filetes Peixe Galo,11.5,2026-01-28
Filetes de Polvo,7.5,2026-01-28
Fino,9.0,2026-01-28
Maça Assada,2.0,2026-01-28
Menu Dia,15.0,2026-01-28
Mouse,2.0,2026-01-28
Pera Bêbada,1.0,2026-01-28
Polvo à Lagareiro,1.0,2026-01-28
Prato do dia Carne,18.0,2026-01-28
Prato do dia Peixe,12.0,2026-01-28
Prego,1.0,2026-01-28
Pudim,1.0,2026-01-28
Queijo Couvert,1.0,2026-01-28
Remy Martin,1.0,2026-01-28
Sopa de Marisco,2.0,2026-01-28
Sopa de Peixe,3.0,2026-01-28
TT Duvalley,1.0,2026-01-28
TT Quinta da Leda,1.0,2026-01-28
TT Ribeiro Santo Res,1.0,2026-01-28
Take Away,5.0,2026-01-28
Vinho 0.5L,4.0,2026-01-28
Vinho Branco da casa (copo),1.0,2026-01-28
Água Menu,6.0,2026-01-28
Água c/gás,4.0,2026-01-28
Ameijoas à Bulhão Pato,1.0,2026-01-29
Bacalhau à Brás,3.0,2026-01-29
Bacalhau à Lagareiro,1.0,2026-01-29
Bebida Dia,36.0,2026-01-29
Bife Lombo,1.0,2026-01-29
Bife de Atum,1.0,2026-01-29
Bolinhas Alheira (6 Un.),1.0,2026-01-29
Café,30.0,2026-01-29
Caldo Verde,1.0,2026-01-29
Carne de Porco à Alentejana,1.0,2026-01-29
Compal Néctar,2.0,2026-01-29
Couvert,13.0,2026-01-29
Delicia de Chocolate,2.0,2026-01-29
Doce da casa,2.0,2026-01-29
Dourada/Robalo Grelhado,1.0,2026-01-29
E Quinta Ortigão,1.0,2026-01-29
Filetes Peixe Galo,4.0,2026-01-29
Fino,5.0,2026-01-29
Fruta Tropical,2.0,2026-01-29
Ice Tea,2.0,2026-01-29
Magret de Pato,2.0,2026-01-29
Massada de Peixe,1.0,2026-01-29
Maça Assada,3.0,2026-01-29
Menu Dia,22.0,2026-01-29
Mini Sagres,2.0,2026-01-29
Mouse,1.0,2026-01-29
Pera Bêbada,3.0,2026-01-29
Polvo à Lagareiro,1.0,2026-01-29
Posta,1.0,2026-01-29
Prato do dia Carne,10.0,2026-01-29
Prato do dia Peixe,34.0,2026-01-29
Prego,1.0,2026-01-29
Queijo Couvert,2.0,2026-01-29
Salada,1.0,2026-01-29
Sopa,3.0,2026-01-29
Sopa de Peixe,2.0,2026-01-29
TT Galhardini,3.0,2026-01-29
Take Away,2.0,2026-01-29
Vinho 0.5L,5.0,2026-01-29
Vinho 1L,3.0,2026-01-29
Vinho Branco da casa (copo),1.0,2026-01-29
Vinho Tinto da casa (copo),1.0,2026-01-29
Água 0.33L,1.0,2026-01-29
Água 0.5L,2.0,2026-01-29
Água Menu,8.0,2026-01-29
Água c/gás,1.0,2026-01-29
BR GALHARDINI,1.0,2026-01-30
BR Monte Peceguinha,1.0,2026-01-30
BR Vinha Grande,1.0,2026-01-30
Bacalhau à Brás,1.0,2026-01-30
Bacalhau à Lagareiro,3.0,2026-01-30
Bebida Dia,24.0,2026-01-30
Bife Lombo,1.0,2026-01-30
Bolinhas de Alheira (3 Un.),1.0,2026-01-30
Café,20.0,2026-01-30
Caldo Verde,2.0,2026-01-30
Carne de Porco à Alentejana,2.0,2026-01-30
Cesto de Pão,2.0,2026-01-30
Coca-Cola,3.0,2026-01-30
Couvert,7.0,2026-01-30
Delicia de Chocolate,1.0,2026-01-30
Doce da casa,2.0,2026-01-30
Filetes Peixe Galo,8.0,2026-01-30
Filetes de Polvo,3.0,2026-01-30
Fino,10.0,2026-01-30
Fruta,1.0,2026-01-30
Fruta Tropical,1.0,2026-01-30
Ice Tea,3.0,2026-01-30
Maça Assada,2.0,2026-01-30
Melão com Presunto,1.0,2026-01-30
Menu Dia,17.0,2026-01-30
Mouse,2.0,2026-01-30
Prato do dia Carne,2.0,2026-01-30
Prato do dia Peixe,32.0,2026-01-30
Pudim,2.0,2026-01-30
Queijo Couvert,1.0,2026-01-30
Salada,1.0,2026-01-30
Sopa,4.0,2026-01-30
Sopa de Peixe,4.0,2026-01-30
Take Away,2.0,2026-01-30
Taça de Gelado,1.0,2026-01-30
Vinho 1L,1.0,2026-01-30
Vinho Branco da casa (copo),1.0,2026-01-30
Água 0.5L,4.0,2026-01-30
Água Menu,10.0,2026-01-30
Água c/gás,6.0,2026-01-30
Ameijoas à Bulhão Pato,1.0,2026-01-31
Arroz de Polvo,1.0,2026-01-31
Arroz de Rabo de Boi,1.0,2026-01-31
Arroz de Tamboril,1.0,2026-01-31
Azeitonas,1.0,2026-01-31
BR Planalto,1.0,2026-01-31
Bacalhau à Brás,1.0,2026-01-31
Bacalhau à Narcisa,4.0,2026-01-31
Batata dose,1.0,2026-01-31
Bebida Dia,4.0,2026-01-31
Beirão,3.0,2026-01-31
Bife Lombo,1.0,2026-01-31
Bife de Atum,1.0,2026-01-31
Café,35.0,2026-01-31
Cesto de Pão,1.0,2026-01-31
Chá,1.0,2026-01-31
Coca-Cola,12.0,2026-01-31
Couvert,18.0,2026-01-31
Coxa de Pato Confitada,1.0,2026-01-31
Cozido à Portuguesa,7.0,2026-01-31
Doce da casa,10.0,2026-01-31
Dourada/Robalo Grelhado,2.0,2026-01-31
Entrecôte,7.0,2026-01-31
Filetes Peixe Galo,18.0,2026-01-31
Filetes de Polvo,4.0,2026-01-31
Fino,5.0,2026-01-31
Fruta Tropical,2.0,2026-01-31
Ice Tea,1.0,2026-01-31
Jameson,2.0,2026-01-31
Legumes Salteados,1.0,2026-01-31
Maça Assada,1.0,2026-01-31
Menu Dia,2.0,2026-01-31
Mini Sagres,1.0,2026-01-31
Ovos Rotos,1.0,2026-01-31
Pera Bêbada,7.0,2026-01-31
Picanha,5.0,2026-01-31
Posta,3.0,2026-01-31
Prato do dia Carne,4.0,2026-01-31
Pudim,3.0,2026-01-31
Queijo Couvert,4.0,2026-01-31
Salada,1.0,2026-01-31
Sangria 1.5L,2.0,2026-01-31
Sopa de Peixe,4.0,2026-01-31
TT Burmester meia gr.,1.0,2026-01-31
TT Monte Peceguinha,1.0,2026-01-31
TT V.Nídeo Reserva,3.0,2026-01-31
Take Away,7.0,2026-01-31
Taça de Gelado,1.0,2026-01-31
Vinho 0.5L,3.0,2026-01-31
Vinho 1L,1.0,2026-01-31
Vinho Tinto da casa (copo),1.0,2026-01-31
Água 0.5L,16.0,2026-01-31
Água c/gás,2.0,2026-01-31
Arroz de Marisco 2Pax,1.0,2026-02-02
Arroz de Polvo,1.0,2026-02-02
Arroz de Rabo de Boi,1.0,2026-02-02
Azeitonas,1.0,2026-02-02
BR Ribeiro Santo Encruzado,3.0,2026-02-02
BR V. Nídeo SauvignonBlanc,1.0,2026-02-02
BR Vinha Grande,2.0,2026-02-02
Bacalhau à Brás,2.0,2026-02-02
Bebida Dia,6.0,2026-02-02
Bife Lombo,1.0,2026-02-02
Bolinhas Alheira (6 Un.),1.0,2026-02-02
Café,23.0,2026-02-02
Caldo Verde,2.0,2026-02-02
Camarao ao alho,1.0,2026-02-02
Carne de Porco à Alentejana,1.0,2026-02-02
Chouriço Assado,1.0,2026-02-02
Coca-Cola,2.0,2026-02-02
Couvert,12.0,2026-02-02
Doce da casa,1.0,2026-02-02
Filetes Peixe Galo,6.0,2026-02-02
Filetes de Polvo,1.0,2026-02-02
Fino,11.0,2026-02-02
Fruta Tropical,1.0,2026-02-02
Maça Assada,1.0,2026-02-02
Menu Dia,10.0,2026-02-02
Mouse,3.0,2026-02-02
Omelete Camarão,1.0,2026-02-02
Pera Bêbada,2.0,2026-02-02
Polvo à Lagareiro,2.0,2026-02-02
Prato do dia Carne,6.0,2026-02-02
Prato do dia Peixe,14.0,2026-02-02
Pudim,1.0,2026-02-02
Salada,1.0,2026-02-02
Sopa de Peixe,3.0,2026-02-02
TT V.Nídeo Reserva,1.0,2026-02-02
Vinho Branco da casa (copo),1.0,2026-02-02
Vinho Tinto da casa (copo),2.0,2026-02-02
Água 0.5L,12.0,2026-02-02
Água Menu,14.0,2026-02-02
Ameijoas à Bulhão Pato,1.0,2026-02-03
Arroz de Polvo,2.0,2026-02-03
Arroz de Rabo de Boi,1.0,2026-02-03
Arroz dose,1.0,2026-02-03
BR Ribeiro Santo Encruzado,1.0,2026-02-03
BR Valle do Nídeo,1.0,2026-02-03
Bacalhau à Brás,2.0,2026-02-03
Bebida Dia,8.0,2026-02-03
Bife de Atum,1.0,2026-02-03
Café,29.0,2026-02-03
Cesto de Pão,2.0,2026-02-03
Chá,1.0,2026-02-03
Coca-Cola,2.0,2026-02-03
Compal Néctar,1.0,2026-02-03
Couvert,9.0,2026-02-03
Doce da casa,5.0,2026-02-03
Filetes Peixe Galo,14.0,2026-02-03
Filetes de Polvo,2.0,2026-02-03
Fruta Tropical,1.0,2026-02-03
Maça Assada,1.0,2026-02-03
Menu 25€,9.0,2026-02-03
Menu Degustação Simples,18.0,2026-02-03
Menu Dia,12.52,2026-02-03
Pera Bêbada,1.0,2026-02-03
Pica-Pau Terra e Mar,1.0,2026-02-03
Pica-pau,1.0,2026-02-03
Prato do dia Carne,8.0,2026-02-03
Prato do dia Peixe,6.0,2026-02-03
Pudim,1.0,2026-02-03
Queijo Couvert,6.0,2026-02-03
Salada,1.0,2026-02-03
Sangria Espumante 1.5L,1.0,2026-02-03
TT Ribeiro Santo Res,1.0,2026-02-03
TT Ribeiro Santo colheita,2.0,2026-02-03
Take Away,6.0,2026-02-03
Vinho 0.5L,1.0,2026-02-03
Vinho 1L,1.0,2026-02-03
Vinho Menu,18.0,2026-02-03
Água 0.5L,4.0,2026-02-03
Água Menu,6.0,2026-02-03
Água c/gás,2.0,2026-02-03
Arroz de Tamboril,1.0,2026-02-04
Bacalhau à Brás,4.0,2026-02-04
Bebida Dia,20.0,2026-02-04
Bolinhas Alheira (6 Un.),1.0,2026-02-04
Café,14.0,2026-02-04
Carne de Porco à Alentejana,1.0,2026-02-04
Cesto de Pão,1.0,2026-02-04
Coca-Cola,8.0,2026-02-04
Couvert,9.0,2026-02-04
Doce da casa,5.0,2026-02-04
Entrecôte,4.0,2026-02-04
Filetes Peixe Galo,4.0,2026-02-04
Filetes de Polvo,1.0,2026-02-04
Fino,1.0,2026-02-04
Fruta Tropical,2.0,2026-02-04
Maça Assada,1.0,2026-02-04
Menu Dia,13.0,2026-02-04
Pera Bêbada,2.0,2026-02-04
Picanha,1.0,2026-02-04
Prato do dia Carne,10.0,2026-02-04
Prato do dia Peixe,16.0,2026-02-04
Queijo Couvert,1.0,2026-02-04
Sopa,2.0,2026-02-04
TT Vinha Grande,1.0,2026-02-04
Taça de Gelado,1.0,2026-02-04
Vinho 0.5L,3.0,2026-02-04
Vinho 1L,2.0,2026-02-04
Água 0.5L,1.0,2026-02-04
Água Menu,6.0,2026-02-04
Água c/gás,1.0,2026-02-04
Arroz de Rabo de Boi,1.0,2026-02-05
BR Monte Peceguinha,1.0,2026-02-05
Bacalhau à Brás,1.0,2026-02-05
Batata dose,1.0,2026-02-05
Bebida Dia,16.0,2026-02-05
Brandy Croft,1.0,2026-02-05
Café,14.0,2026-02-05
Camarão da Costa,1.0,2026-02-05
Carne de Porco à Alentejana,1.0,2026-02-05
Cesto de Pão,2.0,2026-02-05
Couvert,5.0,2026-02-05
Doce da casa,5.0,2026-02-05
Entrecôte,1.0,2026-02-05
Filetes Peixe Galo,7.5,2026-02-05
Filetes de Polvo,5.5,2026-02-05
Fino,1.0,2026-02-05
Ice Tea,1.0,2026-02-05
Maça Assada,3.0,2026-02-05
Menu Dia,13.0,2026-02-05
Mouse,2.0,2026-02-05
Pera Bêbada,1.0,2026-02-05
Polvo à Lagareiro,1.0,2026-02-05
Posta,1.0,2026-02-05
Prato do dia Carne,10.0,2026-02-05
Prato do dia Peixe,16.0,2026-02-05
Pudim,1.0,2026-02-05
Sopa,1.0,2026-02-05
Sopa de Peixe,2.0,2026-02-05
TT Galhardini,2.0,2026-02-05
TT Vinha Grande,1.0,2026-02-05
Take Away,4.0,2026-02-05
Tostas de Rabo de Boi,2.0,2026-02-05
Vinho 0.5L,3.0,2026-02-05
Vinho Branco da casa (copo),1.0,2026-02-05
Vinho Tinto da casa (copo),1.0,2026-02-05
Água 0.5L,4.0,2026-02-05
Água Menu,10.0,2026-02-05
Água c/gás,1.0,2026-02-05
Ameijoas à Bulhão Pato,1.0,2026-02-06
Amendoa Amarga,1.0,2026-02-06
Azeitonas,1.0,2026-02-06
BR Duvalley,1.0,2026-02-06
BR GALHARDINI,1.0,2026-02-06
BR Ribeiro Santo Colheita,1.0,2026-02-06
Bacalhau à Lagareiro,1.0,2026-02-06
Bebida Dia,8.0,2026-02-06
Bife de Atum,2.0,2026-02-06
Café,12.0,2026-02-06
Cesto de Pão,1.0,2026-02-06
Couvert,7.0,2026-02-06
Doce da casa,4.0,2026-02-06
Filetes Peixe Galo,5.0,2026-02-06
Filetes de Polvo,5.0,2026-02-06
Fino,3.0,2026-02-06
Ice Tea,1.0,2026-02-06
Maça Assada,1.0,2026-02-06
Menu Dia,7.0,2026-02-06
Pera Bêbada,2.0,2026-02-06
Prato do dia Carne,8.0,2026-02-06
Prato do dia Peixe,6.0,2026-02-06
Pudim,1.0,2026-02-06
Queijo Couvert,1.0,2026-02-06
Sopa de Peixe,3.0,2026-02-06
TT V.Nídeo Reserva,1.0,2026-02-06
Tostas de Rabo de Boi,1.0,2026-02-06
Vinho 0.5L,1.0,2026-02-06
Água Menu,6.0,2026-02-06
Ameijoas à Bulhão Pato,1.0,2026-02-07
Arroz Doce,3.0,2026-02-07
Arroz de Pato,5.0,2026-02-07
Arroz de Polvo,1.0,2026-02-07
Arroz de Tamboril,1.0,2026-02-07
Azeitonas,1.0,2026-02-07
Bacalhau à Brás,2.0,2026-02-07
Bacalhau à Narcisa,5.0,2026-02-07
Bife Lombo,1.0,2026-02-07
Bolinhas Alheira (6 Un.),2.0,2026-02-07
Brandy Croft,3.0,2026-02-07
Café,15.0,2026-02-07
Caldo Verde,2.0,2026-02-07
Carne de Porco à Alentejana,1.0,2026-02-07
Coca-Cola,6.0,2026-02-07
Couvert,10.0,2026-02-07
Doce da casa,5.0,2026-02-07
Dourada/Robalo Grelhado,1.0,2026-02-07
Entrecôte,2.0,2026-02-07
Filetes Peixe Galo,7.0,2026-02-07
Filetes de Polvo,4.0,2026-02-07
Ice Tea,3.0,2026-02-07
Maça Assada,1.0,2026-02-07
Mouse,5.0,2026-02-07
Pica-Pau Terra e Mar,1.0,2026-02-07
Picanha,1.0,2026-02-07
Sopa,1.0,2026-02-07
Sopa de Peixe,2.0,2026-02-07
Take Away,3.0,2026-02-07
Tostas de Rabo de Boi,1.0,2026-02-07
Vinho 0.5L,10.0,2026-02-07
Vinho Branco da casa (copo),1.0,2026-02-07
Água 0.5L,8.0,2026-02-07
Arroz de Pato,1.0,2026-02-09
Bacalhau à Narcisa,1.0,2026-02-09
Bebida Dia,4.0,2026-02-09
Bife Lombo,2.0,2026-02-09
Bife de Atum,2.0,2026-02-09
Bolinhas Alheira (6 Un.),1.0,2026-02-09
Café,6.0,2026-02-09
Caldo Verde,3.0,2026-02-09
Carne de Porco à Alentejana,2.0,2026-02-09
Coca-Cola,3.0,2026-02-09
Couvert,7.0,2026-02-09
Doce da casa,2.0,2026-02-09
Entrecôte,2.0,2026-02-09
Filetes Peixe Galo,3.0,2026-02-09
Filetes de Polvo,1.0,2026-02-09
Ice Tea,3.0,2026-02-09
Magret de Pato,1.0,2026-02-09
Menu Dia,6.0,2026-02-09
Mini Sagres,1.0,2026-02-09
Mouse,3.0,2026-02-09
Prato do dia Carne,8.0,2026-02-09
Prato do dia Peixe,4.0,2026-02-09
Pudim,3.0,2026-02-09
Seven Up,1.0,2026-02-09
Take Away,1.0,2026-02-09
Vinho 0.5L,3.0,2026-02-09
Água 0.5L,5.0,2026-02-09
Água Menu,8.0,2026-02-09
Azeitonas,1.0,2026-02-10
BR Luis Pato Vinhas Velhas,1.0,2026-02-10
Bebida Dia,8.0,2026-02-10
Café,4.0,2026-02-10
Coca-Cola,1.0,2026-02-10
Couvert,2.0,2026-02-10
Doce da casa,3.0,2026-02-10
Entrecôte,1.0,2026-02-10
Filetes Peixe Galo,5.5,2026-02-10
Fino,1.0,2026-02-10
Menu Dia,5.0,2026-02-10
Prato do dia Carne,4.0,2026-02-10
Prato do dia Peixe,6.0,2026-02-10
Pudim,1.0,2026-02-10
Sopa de Peixe,1.0,2026-02-10
Take Away,2.0,2026-02-10
Tostas de Rabo de Boi,1.0,2026-02-10
Água 0.5L,2.0,2026-02-10
Água Menu,2.0,2026-02-10
Água c/gás,1.0,2026-02-10
Bife de Atum,1.0,2026-02-11
Brandy Croft,3.0,2026-02-11
CRF-Reserva,1.0,2026-02-11
Café,4.0,2026-02-11
Caldo Verde,1.0,2026-02-11
Fino,4.0,2026-02-11
Menu Dia,2.0,2026-02-11
Prato do dia Carne,2.0,2026-02-11
Prato do dia Peixe,2.0,2026-02-11
Prego,2.0,2026-02-11
Sopa de Peixe,1.0,2026-02-11
Água 0.5L,1.0,2026-02-11
Água Menu,4.0,2026-02-11
Arroz de Polvo,1.0,2026-02-12
Azeitonas,1.0,2026-02-12
Bacalhau à Brás,1.0,2026-02-12
Bacalhau à Lagareiro,2.0,2026-02-12
Bebida Dia,2.0,2026-02-12
Brandy Croft,1.0,2026-02-12
Café,12.0,2026-02-12
Caldo Verde,5.0,2026-02-12
Carne de Porco à Alentejana,2.0,2026-02-12
Coca-Cola,3.0,2026-02-12
Compal Néctar,2.0,2026-02-12
Couvert,6.0,2026-02-12
Entrecôte,1.0,2026-02-12
Filetes Peixe Galo,5.0,2026-02-12
Fino,6.0,2026-02-12
Maça Assada,1.0,2026-02-12
Menu Dia,3.0,2026-02-12
Ovos Rotos,2.0,2026-02-12
Pera Bêbada,2.0,2026-02-12
Prato do dia Carne,2.0,2026-02-12
Prato do dia Peixe,4.0,2026-02-12
Pudim,2.0,2026-02-12
Sangria 1.5L,2.0,2026-02-12
TT Papa Figos,1.0,2026-02-12
Take Away,1.0,2026-02-12
Tostas de Rabo de Boi,3.0,2026-02-12
Vinho 0.5L,1.0,2026-02-12
Vinho Branco da casa (copo),4.0,2026-02-12
Vinho Tinto da casa (copo),1.0,2026-02-12
Água 0.5L,6.0,2026-02-12
Água Menu,4.0,2026-02-12
Aliança XO 10 anos,2.0,2026-02-13
Bacalhau à Lagareiro,1.0,2026-02-13
Bebida Dia,8.0,2026-02-13
Beirão,2.0,2026-02-13
Bolinhas de Alheira (3 Un.),1.0,2026-02-13
Café,18.0,2026-02-13
Camarao ao alho,1.0,2026-02-13
Carne de Porco à Alentejana,2.0,2026-02-13
Coca-Cola,3.0,2026-02-13
Couvert,11.0,2026-02-13
Coxa de Pato Confitada,2.0,2026-02-13
Doce da casa,7.0,2026-02-13
Filetes Peixe Galo,8.0,2026-02-13
Filetes de Polvo,6.5,2026-02-13
Fino,3.0,2026-02-13
Magret de Pato,2.0,2026-02-13
Menu Dia,8.0,2026-02-13
Mouse,2.0,2026-02-13
Ovos Rotos,1.0,2026-02-13
Pera Bêbada,2.0,2026-02-13
Picanha,5.0,2026-02-13
Polvo à Lagareiro,1.0,2026-02-13
Prato do dia Carne,6.0,2026-02-13
Prato do dia Peixe,10.0,2026-02-13
Pudim,2.0,2026-02-13
Queijo Couvert,1.0,2026-02-13
Salada,1.0,2026-02-13
Sangria 1.5L,1.0,2026-02-13
TT Monte Peceguinha,2.0,2026-02-13
TT Ribeiro Santo Res,2.0,2026-02-13
V Muralhas,1.0,2026-02-13
Vinho 0.5L,6.0,2026-02-13
Vinho 1L,3.0,2026-02-13
Vinho Tinto da casa (copo),1.0,2026-02-13
Água 0.5L,3.0,2026-02-13
Água Menu,8.0,2026-02-13
Água c/gás,3.0,2026-02-13
Aliança XO 10 anos,1.0,2026-02-14
Arroz de Polvo,1.0,2026-02-14
Arroz de Rabo de Boi,1.0,2026-02-14
Arroz de Tamboril,1.0,2026-02-14
Arroz dose,1.0,2026-02-14
BR Planalto,1.0,2026-02-14
BR Ribeiro Santo Encruzado,1.0,2026-02-14
Bacalhau à Brás,2.0,2026-02-14
Bacalhau à Narcisa,9.0,2026-02-14
Beirão D'honra,1.0,2026-02-14
Bife Lombo,1.0,2026-02-14
Bife de Atum,2.0,2026-02-14
Bolinhas Alheira (6 Un.),1.0,2026-02-14
Bolinhas de Alheira (3 Un.),1.0,2026-02-14
Café,38.0,2026-02-14
Caldo Verde,1.0,2026-02-14
Carne de Porco à Alentejana,2.0,2026-02-14
Cataplana de Peixe 2Pax,1.0,2026-02-14
Cerveja S/Alcool,1.0,2026-02-14
Coca-Cola,2.0,2026-02-14
Couvert,21.0,2026-02-14
Coxa de Pato Confitada,1.0,2026-02-14
Cozido à Portuguesa,4.0,2026-02-14
Doce da casa,13.0,2026-02-14
Dourada/Robalo Grelhado,1.0,2026-02-14
E S.Domingos,1.0,2026-02-14
Entrecôte,6.0,2026-02-14
Filetes Peixe Galo,25.0,2026-02-14
Filetes de Polvo,12.5,2026-02-14
Fino,7.0,2026-02-14
Fruta Tropical,1.0,2026-02-14
Gin Paragon,4.0,2026-02-14
Ice Tea,1.0,2026-02-14
Mouse,8.0,2026-02-14
Ovos Rotos,2.0,2026-02-14
Pera Bêbada,3.0,2026-02-14
Picanha,1.0,2026-02-14
Polvo Ensalsado,1.0,2026-02-14
Polvo à Lagareiro,1.0,2026-02-14
Porto 10 anos Tawny,1.0,2026-02-14
Pudim,3.0,2026-02-14
Queijo Couvert,3.0,2026-02-14
Salada,3.0,2026-02-14
Sangria 1L,1.0,2026-02-14
Sangria Espumante 1.5L,1.0,2026-02-14
Sopa,2.0,2026-02-14
Sopa de Peixe,5.0,2026-02-14
TT Duvalley Reserva,1.0,2026-02-14
TT Monte Peceguinha,1.0,2026-02-14
TT V.Nídeo Reserva,1.0,2026-02-14
TT Vinha Grande,1.0,2026-02-14
Take Away,3.0,2026-02-14
Taça de Gelado,3.0,2026-02-14
Tostas de Rabo de Boi,1.0,2026-02-14
Vinho 0.5L,5.0,2026-02-14
Vinho 1L,2.0,2026-02-14
Vinho Branco da casa (copo),2.0,2026-02-14
Água 0.5L,14.0,2026-02-14
Água c/gás,4.0,2026-02-14
Ameijoas à Bulhão Pato,3.0,2026-02-16
Amendoa Amarga,1.0,2026-02-16
Arroz de Polvo,1.0,2026-02-16
Arroz de Rabo de Boi,3.0,2026-02-16
Arroz de Tamboril,2.0,2026-02-16
BR Luis Pato Maria Gomes,1.0,2026-02-16
BR Luis Pato Vinhas Velhas,1.0,2026-02-16
BR Qta Portal Moscatel,1.0,2026-02-16
BR Ribeiro Santo Encruzado,1.0,2026-02-16
Bacalhau à Brás,1.0,2026-02-16
Bacalhau à Lagareiro,2.0,2026-02-16
Bebida Dia,6.0,2026-02-16
Bife de Atum,2.0,2026-02-16
Black Label,4.0,2026-02-16
CRF-Reserva,1.0,2026-02-16
Café,30.0,2026-02-16
Camarao ao alho,1.0,2026-02-16
Cesto de Pão,4.0,2026-02-16
Coca-Cola,8.0,2026-02-16
Couvert,16.0,2026-02-16
Doce da casa,13.0,2026-02-16
Dourada/Robalo Grelhado,2.0,2026-02-16
Entrecôte,4.0,2026-02-16
Filetes Peixe Galo,45.5,2026-02-16
Filetes de Polvo,5.0,2026-02-16
Fino,10.0,2026-02-16
Ice Tea,4.0,2026-02-16
Maça Assada,2.0,2026-02-16
Menu Dia,9.0,2026-02-16
Mouse,4.0,2026-02-16
Ovos Rotos,1.0,2026-02-16
Pera Bêbada,4.0,2026-02-16
Picanha,1.0,2026-02-16
Polvo Ensalsado,1.0,2026-02-16
Prato do dia Carne,6.0,2026-02-16
Prato do dia Peixe,12.0,2026-02-16
Pudim,10.0,2026-02-16
Queijo Couvert,1.0,2026-02-16
Sangria Espumante 1.5L,2.0,2026-02-16
Sopa de Peixe,2.0,2026-02-16
TT Monte Peceguinha,8.0,2026-02-16
Take Away,6.0,2026-02-16
Tostas de Rabo de Boi,2.0,2026-02-16
Vinho 0.5L,3.0,2026-02-16
Vinho 1L,2.0,2026-02-16
Água 0.5L,13.0,2026-02-16
Água Menu,12.0,2026-02-16
Água c/gás,7.0,2026-02-16
Ameijoas à Bulhão Pato,1.0,2026-02-17
Arroz de Rabo de Boi,2.0,2026-02-17
Arroz de Tamboril,1.0,2026-02-17
Bacalhau à Brás,1.0,2026-02-17
Bacalhau à Lagareiro,1.0,2026-02-17
Brandy Croft,1.0,2026-02-17
Café,14.0,2026-02-17
Camarao ao alho,3.0,2026-02-17
Carne de Porco à Alentejana,2.0,2026-02-17
Coca-Cola,5.0,2026-02-17
Compal Néctar,1.0,2026-02-17
Couvert,10.0,2026-02-17
Doce da casa,2.0,2026-02-17
Entrecôte,2.0,2026-02-17
Filetes Peixe Galo,9.5,2026-02-17
Filetes de Polvo,3.5,2026-02-17
Fino,7.0,2026-02-17
Ice Tea,1.0,2026-02-17
Magret de Pato,1.0,2026-02-17
Maça Assada,4.0,2026-02-17
Menu 25€,7.0,2026-02-17
Menu Degustação Simples,14.0,2026-02-17
Menu Dia,7.0,2026-02-17
"Menu Dia,Prato do dia Peixe,Água Menu",1.0,2026-02-17
Mouse,2.0,2026-02-17
Omelete Camarão,1.0,2026-02-17
Ovos Rotos,2.0,2026-02-17
Pera Bêbada,1.0,2026-02-17
Pica-pau,1.0,2026-02-17
Prato do dia Carne,2.0,2026-02-17
Prato do dia Peixe,6.0,2026-02-17
Pudim,2.0,2026-02-17
Salada,1.0,2026-02-17
Seven Up,3.0,2026-02-17
Sopa de Peixe,6.0,2026-02-17
TT Duvalley Reserva,2.0,2026-02-17
TT Qta Portal Colheita,1.0,2026-02-17
TT V.Nídeo Reserva,1.0,2026-02-17
TT Vinha Grande,1.0,2026-02-17
Take Away,3.0,2026-02-17
Tostas de Rabo de Boi,4.0,2026-02-17
Vinho Branco da casa (copo),1.0,2026-02-17
Vinho Menu,14.0,2026-02-17
Água 0.5L,4.0,2026-02-17
Água Menu,8.0,2026-02-17
Água c/gás,2.0,2026-02-17
Arroz de Polvo,1.0,2026-02-18
Arroz de Tamboril,4.0,2026-02-18
Azeitonas,1.0,2026-02-18
BR Ribeiro Santo Encruzado,3.0,2026-02-18
Bayleys,2.0,2026-02-18
Bebida Dia,10.0,2026-02-18
Bife Lombo,1.0,2026-02-18
Black Label,5.0,2026-02-18
Café,22.0,2026-02-18
Carne de Porco à Alentejana,2.0,2026-02-18
Cesto de Pão,2.0,2026-02-18
Chá,1.0,2026-02-18
Coca-Cola,1.0,2026-02-18
Couvert,7.0,2026-02-18
Delicia de Chocolate,4.0,2026-02-18
Doce da casa,7.0,2026-02-18
Filetes Peixe Galo,3.0,2026-02-18
Filetes de Polvo,1.0,2026-02-18
Fino,5.0,2026-02-18
Fruta Tropical,1.0,2026-02-18
Ice Tea,1.0,2026-02-18
Maça Assada,2.0,2026-02-18
Menu Dia,23.36,2026-02-18
Mouse,2.0,2026-02-18
Omelete Camarão,1.0,2026-02-18
Ovos Rotos,1.0,2026-02-18
Pera Bêbada,1.0,2026-02-18
Picanha,1.0,2026-02-18
Porto 10 anos Tawny,1.0,2026-02-18
Prato do dia Carne,14.0,2026-02-18
Prato do dia Peixe,12.0,2026-02-18
Sopa,1.0,2026-02-18
Sopa de Peixe,2.0,2026-02-18
Take Away,3.0,2026-02-18
Tostas de Rabo de Boi,2.0,2026-02-18
Vinho 0.5L,2.0,2026-02-18
Vinho 1L,3.0,2026-02-18
Vinho Branco da casa (copo),2.0,2026-02-18
Água 0.5L,3.0,2026-02-18
Água Menu,16.0,2026-02-18
Água c/gás,1.0,2026-02-18
Ameijoas à Bulhão Pato,2.0,2026-02-19
BR Dona Matilde,1.0,2026-02-19
Bacalhau à Brás,1.0,2026-02-19
Bebida Dia,12.0,2026-02-19
Bife Lombo,2.0,2026-02-19
Café,15.0,2026-02-19
Caldo Verde,1.0,2026-02-19
Carne de Porco à Alentejana,1.0,2026-02-19
Coca-Cola,3.0,2026-02-19
Couvert,8.0,2026-02-19
Delicia de Chocolate,2.0,2026-02-19
Doce da casa,3.0,2026-02-19
Dourada/Robalo Grelhado,2.0,2026-02-19
Entrecôte,1.0,2026-02-19
Filetes Peixe Galo,4.0,2026-02-19
Filetes de Polvo,5.5,2026-02-19
Fino,2.0,2026-02-19
Maça Assada,2.0,2026-02-19
Menu Dia,9.0,2026-02-19
Pera Bêbada,3.0,2026-02-19
Prato do dia Carne,6.0,2026-02-19
Prato do dia Peixe,12.0,2026-02-19
Pudim,1.0,2026-02-19
Sopa,1.0,2026-02-19
Sopa de Peixe,2.0,2026-02-19
Take Away,3.0,2026-02-19
Vinho 0.5L,2.0,2026-02-19
Vinho Tinto da casa (copo),1.0,2026-02-19
Água 0.5L,6.0,2026-02-19
Água Menu,6.0,2026-02-19
Água c/gás,1.0,2026-02-19
Arroz Conquilhas,1.0,2026-02-20
Arroz de Tamboril,2.0,2026-02-20
Bacalhau à Brás,2.0,2026-02-20
Bacalhau à Lagareiro,1.0,2026-02-20
Bebida Dia,2.0,2026-02-20
Bolinhas de Alheira (3 Un.),1.0,2026-02-20
Café,7.0,2026-02-20
Camarao ao alho,2.0,2026-02-20
Carne de Porco à Alentejana,5.0,2026-02-20
Coca-Cola,1.0,2026-02-20
Compal Néctar,1.0,2026-02-20
Couvert,6.0,2026-02-20
Doce da casa,1.0,2026-02-20
Filetes Peixe Galo,4.0,2026-02-20
Fino,1.0,2026-02-20
Magret de Pato,2.0,2026-02-20
Maça Assada,1.0,2026-02-20
Menu Dia,3.0,2026-02-20
Mini Sagres,9.0,2026-02-20
Mouse,1.0,2026-02-20
Omelete Camarão,2.0,2026-02-20
Ovos Rotos,1.0,2026-02-20
Pera Bêbada,3.0,2026-02-20
Prato do dia Carne,4.0,2026-02-20
Prato do dia Peixe,2.0,2026-02-20
Pudim,1.0,2026-02-20
Sopa de Peixe,1.0,2026-02-20
TT Galhardini,2.0,2026-02-20
TT Ribeiro Santo Res,1.0,2026-02-20
Take Away,1.0,2026-02-20
Vinho 0.5L,3.0,2026-02-20
Vinho 1L,1.0,2026-02-20
Vinho Branco da casa (copo),4.0,2026-02-20
Vinho Tinto da casa (copo),1.0,2026-02-20
Água 0.5L,5.0,2026-02-20
Água Menu,4.0,2026-02-20
Alheira,1.0,2026-02-21
Ameijoas à Bulhão Pato,2.0,2026-02-21
Arroz de Polvo,1.0,2026-02-21
Arroz de Rabo de Boi,2.0,2026-02-21
Arroz de Tamboril,2.0,2026-02-21
BR Dona Matilde,2.0,2026-02-21
BR Valle do Nídeo,1.0,2026-02-21
BR Vinha Grande,1.0,2026-02-21
Bacalhau à Brás,3.0,2026-02-21
Bacalhau à Narcisa,4.0,2026-02-21
Batata dose,2.0,2026-02-21
Bebida Dia,4.0,2026-02-21
Bife de Atum,1.0,2026-02-21
CRF-Reserva,1.0,2026-02-21
Café,29.0,2026-02-21
Caldo Verde,1.0,2026-02-21
Carne de Porco à Alentejana,1.0,2026-02-21
Cesto de Pão,3.0,2026-02-21
Coca-Cola,5.0,2026-02-21
Couvert,16.0,2026-02-21
Coxa de Pato Confitada,2.0,2026-02-21
Cozido à Portuguesa,3.0,2026-02-21
Doce da casa,4.0,2026-02-21
Dourada/Robalo Grelhado,2.0,2026-02-21
Entrecôte,1.0,2026-02-21
Filetes Peixe Galo,38.5,2026-02-21
Filetes de Polvo,11.5,2026-02-21
Fino,10.0,2026-02-21
Fruta Tropical,2.0,2026-02-21
Magret de Pato,1.0,2026-02-21
Manteiga,1.0,2026-02-21
Maça Assada,3.0,2026-02-21
Menu Dia,2.0,2026-02-21
Mouse,5.0,2026-02-21
Ovo estrelado,1.0,2026-02-21
Pera Bêbada,6.0,2026-02-21
Posta,2.0,2026-02-21
Prato do dia Carne,4.0,2026-02-21
Pudim,1.0,2026-02-21
Salada,1.0,2026-02-21
Sangria 1.5L,1.0,2026-02-21
Seven Up,1.0,2026-02-21
Sopa,5.0,2026-02-21
Sopa de Peixe,13.0,2026-02-21
Take Away,9.0,2026-02-21
Taça de Gelado,1.0,2026-02-21
Vegetariano,1.0,2026-02-21
Vinho 0.5L,14.0,2026-02-21
Vinho 1L,1.0,2026-02-21
Vinho Branco da casa (copo),4.0,2026-02-21
Vinho Tinto da casa (copo),2.0,2026-02-21
Água 0.5L,14.0,2026-02-21
Água c/gás,5.0,2026-02-21
Arroz Doce,1.0,2026-02-23
Arroz de Polvo,1.0,2026-02-23
Arroz de Rabo de Boi,1.0,2026-02-23
Arroz de Tamboril,2.0,2026-02-23
BR Monte Peceguinha,1.0,2026-02-23
BR Ribeiro Santo Encruzado,2.0,2026-02-23
Bacalhau à Brás,2.0,2026-02-23
Bebida Dia,20.0,2026-02-23
Bife Lombo,1.0,2026-02-23
Bolinhas Alheira (6 Un.),1.0,2026-02-23
Café,29.0,2026-02-23
Camarao ao alho,1.0,2026-02-23
Carne de Porco à Alentejana,2.0,2026-02-23
Cesto de Pão,1.0,2026-02-23
Couvert,14.0,2026-02-23
Coxa de Pato Confitada,1.0,2026-02-23
Delicia de Chocolate,2.0,2026-02-23
Doce da casa,6.0,2026-02-23
Filetes Peixe Galo,6.0,2026-02-23
Filetes de Polvo,4.0,2026-02-23
Fino,18.0,2026-02-23
Fruta Tropical,3.0,2026-02-23
Magret de Pato,1.0,2026-02-23
Maça Assada,6.0,2026-02-23
Menu Dia,24.0,2026-02-23
Mouse,1.0,2026-02-23
Picanha,1.0,2026-02-23
Polvo à Lagareiro,1.0,2026-02-23
Prato do dia Carne,10.0,2026-02-23
Prato do dia Peixe,38.0,2026-02-23
Pudim,3.0,2026-02-23
Queijo Couvert,2.0,2026-02-23
Sangria 1L,1.0,2026-02-23
TT Vinha Grande,1.0,2026-02-23
Take Away,3.0,2026-02-23
Vinho 0.5L,2.0,2026-02-23
Vinho 1L,1.0,2026-02-23
Vinho Branco da casa (copo),2.0,2026-02-23
Vinho Tinto da casa (copo),1.0,2026-02-23
Whisky Novo,1.0,2026-02-23
Água 0.5L,6.0,2026-02-23
Água Menu,28.0,2026-02-23
Água c/gás,1.0,2026-02-23
Ameijoas à Bulhão Pato,1.0,2026-02-24
Arroz de Polvo,1.0,2026-02-24
Bacalhau à Brás,1.0,2026-02-24
Bacalhau à Lagareiro,2.0,2026-02-24
Bebida Dia,14.0,2026-02-24
Café,12.0,2026-02-24
Caldo Verde,2.0,2026-02-24
Cesto de Pão,1.0,2026-02-24
Compal Néctar,2.0,2026-02-24
Couvert,6.0,2026-02-24
Filetes Peixe Galo,4.0,2026-02-24
Filetes de Polvo,1.0,2026-02-24
Fino,4.0,2026-02-24
Fruta,1.0,2026-02-24
Fruta Tropical,1.0,2026-02-24
Menu 25€,6.0,2026-02-24
Menu Degustação Simples,12.0,2026-02-24
Menu Dia,11.0,2026-02-24
Mini Sagres,1.0,2026-02-24
Mouse,2.0,2026-02-24
Pica-Pau Terra e Mar,1.0,2026-02-24
Polvo Ensalsado,1.0,2026-02-24
Polvo à Lagareiro,1.0,2026-02-24
Prato do dia Carne,10.0,2026-02-24
Prato do dia Peixe,12.0,2026-02-24
Prego,1.0,2026-02-24
Pudim,1.0,2026-02-24
Sangria 1L,1.0,2026-02-24
Sopa de Peixe,3.0,2026-02-24
Take Away,2.0,2026-02-24
Tostas de Rabo de Boi,2.0,2026-02-24
Vinho 0.5L,2.0,2026-02-24
Vinho Branco da casa (copo),1.0,2026-02-24
Vinho Menu,12.0,2026-02-24
Vinho Tinto da casa (copo),1.0,2026-02-24
Água 0.5L,1.0,2026-02-24
Água Menu,8.0,2026-02-24
Água c/gás,2.0,2026-02-24
Arroz Doce,3.0,2026-02-25
Arroz de Rabo de Boi,2.0,2026-02-25
BR Ribeiro Santo Encruzado,2.0,2026-02-25
BR Valle do Nídeo,2.0,2026-02-25
Bebida Dia,32.0,2026-02-25
Bife Lombo,4.0,2026-02-25
Bife de Atum,1.0,2026-02-25
Café,30.0,2026-02-25
Carne de Porco à Alentejana,1.0,2026-02-25
Cesto de Pão,1.0,2026-02-25
Coca-Cola,4.0,2026-02-25
Couvert,12.0,2026-02-25
Delicia de Chocolate,2.0,2026-02-25
Doce da casa,11.0,2026-02-25
Entrecôte,3.0,2026-02-25
Filetes Peixe Galo,27.5,2026-02-25
Filetes de Polvo,7.5,2026-02-25
Fino,7.0,2026-02-25
Fruta,1.0,2026-02-25
Ice Tea,2.0,2026-02-25
Maça Assada,2.0,2026-02-25
Menu Dia,44.9,2026-02-25
"Menu Dia,Prato do dia Peixe,Bebida Dia",5.1,2026-02-25
Mouse,3.0,2026-02-25
Pera Bêbada,10.0,2026-02-25
Polvo à Lagareiro,1.0,2026-02-25
Posta,2.0,2026-02-25
Prato do dia Carne,12.0,2026-02-25
Prato do dia Peixe,38.0,2026-02-25
Pudim,5.0,2026-02-25
Salada,1.0,2026-02-25
Sangria 1.5L,2.0,2026-02-25
Sopa,2.0,2026-02-25
TT Duvalley,1.0,2026-02-25
TT Titular Reserva,1.0,2026-02-25
TT V.Nídeo Reserva,2.0,2026-02-25
Vinho 0.5L,1.0,2026-02-25
Vinho Branco da casa (copo),1.0,2026-02-25
Água 0.5L,5.0,2026-02-25
Água Menu,18.0,2026-02-25
Água c/gás,1.0,2026-02-25
Arroz Doce,3.0,2026-02-26
Arroz de Rabo de Boi,2.0,2026-02-26
Azeitonas,1.0,2026-02-26
BR Volupia,1.0,2026-02-26
Bacalhau à Lagareiro,3.0,2026-02-26
Bebida Dia,10.0,2026-02-26
Bife Lombo,1.0,2026-02-26
Café,18.0,2026-02-26
Camarao ao alho,1.0,2026-02-26
Carne de Porco à Alentejana,1.0,2026-02-26
Coca-Cola,4.0,2026-02-26
Couvert,10.0,2026-02-26
Delicia de Chocolate,3.0,2026-02-26
Doce da casa,1.0,2026-02-26
Entrecôte,1.0,2026-02-26
Filetes Peixe Galo,8.0,2026-02-26
Filetes de Polvo,2.0,2026-02-26
Fino,6.0,2026-02-26
Fruta Tropical,1.0,2026-02-26
Massada de Peixe,1.0,2026-02-26
Maça Assada,2.0,2026-02-26
Menu Dia,7.0,2026-02-26
Ovos Rotos,1.0,2026-02-26
Pera Bêbada,7.0,2026-02-26
Picanha,1.0,2026-02-26
Polvo Ensalsado,1.0,2026-02-26
Posta,1.0,2026-02-26
Prato do dia Carne,10.0,2026-02-26
Prato do dia Peixe,4.0,2026-02-26
Sopa,1.0,2026-02-26
Sopa de Peixe,1.0,2026-02-26
TT Galhardini,2.0,2026-02-26
TT Ribeiro Santo colheita,1.0,2026-02-26
Take Away,1.0,2026-02-26
Taça de Gelado,1.0,2026-02-26
Vinho 0.5L,3.0,2026-02-26
Vinho Branco da casa (copo),1.0,2026-02-26
Água 0.5L,5.0,2026-02-26
Água Menu,4.0,2026-02-26
Água c/gás,3.0,2026-02-26
Ameijoas à Bulhão Pato,1.0,2026-02-27
Arroz Doce,1.0,2026-02-27
BR Papa Figos,1.0,2026-02-27
Bebida Dia,8.0,2026-02-27
Bife de Atum,5.0,2026-02-27
Bolinhas Alheira (6 Un.),1.0,2026-02-27
Café,10.0,2026-02-27
Coca-Cola,1.0,2026-02-27
Couvert,6.0,2026-02-27
Doce da casa,3.0,2026-02-27
Entrecôte,1.0,2026-02-27
Filetes Peixe Galo,3.0,2026-02-27
Filetes de Polvo,2.0,2026-02-27
Fino,4.0,2026-02-27
Maça Assada,1.0,2026-02-27
Menu Dia,7.0,2026-02-27
Mouse,3.0,2026-02-27
Nordés,2.0,2026-02-27
Pera Bêbada,1.0,2026-02-27
Picanha,3.0,2026-02-27
Prato do dia Carne,2.0,2026-02-27
Prato do dia Peixe,12.0,2026-02-27
Pudim,2.0,2026-02-27
Sangria Espumante 1.5L,1.0,2026-02-27
Sopa de Peixe,7.0,2026-02-27
Água 0.5L,6.0,2026-02-27
Água Menu,6.0,2026-02-27
Água c/gás,4.0,2026-02-27
Ameijoas à Bulhão Pato,3.0,2026-02-28
Arroz de Lingueirão,5.0,2026-02-28
Arroz de Polvo,2.0,2026-02-28
Arroz de Rabo de Boi,6.0,2026-02-28
Arroz de Tamboril,1.0,2026-02-28
Azeitonas,1.0,2026-02-28
BR Monte Peceguinha,2.0,2026-02-28
BR Piano Moscatel Galego,1.0,2026-02-28
BR Valle do Nídeo,1.0,2026-02-28
Bacalhau à Brás,5.0,2026-02-28
Beirão,6.0,2026-02-28
Bolinhas Alheira (6 Un.),1.0,2026-02-28
CRF-Reserva,4.0,2026-02-28
Café,41.0,2026-02-28
Caldo Verde,1.0,2026-02-28
Camarao ao alho,1.0,2026-02-28
Carne de Porco à Alentejana,1.0,2026-02-28
Cesto de Pão,2.0,2026-02-28
Coca-Cola,2.0,2026-02-28
Couvert,17.0,2026-02-28
Cozido à Portuguesa,11.0,2026-02-28
Doce da casa,6.0,2026-02-28
E Quinta Ortigão,2.0,2026-02-28
ES S. Domingos Extra Reserva,3.0,2026-02-28
Entrecôte,5.0,2026-02-28
Filetes Peixe Galo,18.5,2026-02-28
Filetes de Polvo,7.5,2026-02-28
Fino,23.0,2026-02-28
Magret de Pato,1.0,2026-02-28
Maça Assada,2.0,2026-02-28
Menu Dia,1.0,2026-02-28
Mini Sagres,12.0,2026-02-28
Mouse,6.0,2026-02-28
Omelete Camarão,1.0,2026-02-28
Ovos Rotos,1.0,2026-02-28
Pera Bêbada,3.0,2026-02-28
Picanha,1.0,2026-02-28
Polvo Ensalsado,3.0,2026-02-28
Posta,1.0,2026-02-28
Prato do dia Carne,2.0,2026-02-28
Pudim,3.0,2026-02-28
Queijo Couvert,1.0,2026-02-28
Salada,2.0,2026-02-28
Sangria 1.5L,1.0,2026-02-28
Seven Up,1.0,2026-02-28
Sopa,4.0,2026-02-28
Sopa de Peixe,3.0,2026-02-28
TT Papa Figos,2.0,2026-02-28
TT V.Nídeo Reserva,4.0,2026-02-28
Take Away,8.0,2026-02-28
Taça de Gelado,3.0,2026-02-28
Tostas de Rabo de Boi,1.0,2026-02-28
Vinho 0.5L,3.0,2026-02-28
Vinho 1L,3.0,2026-02-28
Vinho Branco da casa (copo),2.0,2026-02-28
Vinho Tinto da casa (copo),1.0,2026-02-28
Água 0.5L,9.0,2026-02-28
Água Menu,2.0,2026-02-28
Água c/gás,8.0,2026-02-28
Arroz Doce,4.0,2026-03-02
Arroz de Tamboril,1.0,2026-03-02
Bacalhau à Brás,1.0,2026-03-02
Batata dose,1.0,2026-03-02
Bebida Dia,16.0,2026-03-02
Bife Lombo,3.0,2026-03-02
CRF-Reserva,2.0,2026-03-02
Café,19.0,2026-03-02
Carne de Porco à Alentejana,1.0,2026-03-02
Cesto de Pão,1.0,2026-03-02
Coca-Cola,3.0,2026-03-02
Compal Néctar,1.0,2026-03-02
Couvert,13.0,2026-03-02
Doce da casa,2.0,2026-03-02
Dourada/Robalo Grelhado,1.0,2026-03-02
Filetes Peixe Galo,9.0,2026-03-02
Filetes de Polvo,5.5,2026-03-02
Fino,8.0,2026-03-02
Magret de Pato,1.0,2026-03-02
Maça Assada,1.0,2026-03-02
Menu Dia,25.99,2026-03-02
"Menu Dia,Prato do dia Peixe,Água Menu",2.01,2026-03-02
Mouse,2.0,2026-03-02
Ovos Rotos,1.0,2026-03-02
Pera Bêbada,3.0,2026-03-02
Prato do dia Carne,6.0,2026-03-02
Prato do dia Peixe,22.0,2026-03-02
Prego,1.0,2026-03-02
Pudim,3.0,2026-03-02
Queijo Couvert,4.0,2026-03-02
Sangria Espumante 1.5L,2.0,2026-03-02
Sopa,1.0,2026-03-02
TT Dona Matilde,1.0,2026-03-02
TT Quinta da Leda,2.0,2026-03-02
TT Vinha Grande,2.0,2026-03-02
Take Away,3.0,2026-03-02
Tostas de Rabo de Boi,2.0,2026-03-02
Vinho 0.5L,1.0,2026-03-02
Vinho Tinto da casa (copo),2.0,2026-03-02
Água 0.5L,3.0,2026-03-02
Água Menu,12.0,2026-03-02
Água c/gás,2.0,2026-03-02
Ameijoas à Bulhão Pato,1.0,2026-03-03
Arroz de Polvo,1.0,2026-03-03
Azeitonas,1.0,2026-03-03
BR Ribeiro Santo Encruzado,1.0,2026-03-03
Batata dose,1.0,2026-03-03
Bebida Dia,22.0,2026-03-03
Bife Lombo,2.0,2026-03-03
Café,14.0,2026-03-03
Camarao ao alho,1.0,2026-03-03
Cerveja S/Alcool,1.0,2026-03-03
Coca-Cola,3.0,2026-03-03
Couvert,9.0,2026-03-03
Entrecôte,1.0,2026-03-03
Filetes Peixe Galo,4.0,2026-03-03
Filetes de Polvo,2.5,2026-03-03
Fino,7.0,2026-03-03
Maça Assada,2.0,2026-03-03
Menu 25€,8.0,2026-03-03
Menu Degustação Simples,16.0,2026-03-03
Menu Dia,12.0,2026-03-03
Ovos Rotos,1.0,2026-03-03
Pera Bêbada,4.0,2026-03-03
Picanha,1.0,2026-03-03
Prato do dia Carne,6.0,2026-03-03
Prato do dia Peixe,18.0,2026-03-03
Sopa de Peixe,3.0,2026-03-03
TT Galhardini,1.0,2026-03-03
Take Away,2.0,2026-03-03
Tostas de Rabo de Boi,1.0,2026-03-03
Vinho 0.5L,2.0,2026-03-03
Vinho Menu,16.0,2026-03-03
Água 0.33L,1.0,2026-03-03
Água Menu,2.0,2026-03-03
Água c/gás,1.0,2026-03-03
Ameijoas à Bulhão Pato,1.0,2026-03-04
Arroz de Tamboril,2.0,2026-03-04
Azeitonas,1.0,2026-03-04
Bacalhau à Brás,3.0,2026-03-04
Bacalhau à Lagareiro,1.0,2026-03-04
Bebida Dia,16.0,2026-03-04
Bife de Atum,1.0,2026-03-04
Café,11.0,2026-03-04
Caldo Verde,2.0,2026-03-04
Camarao ao alho,1.0,2026-03-04
Cesto de Pão,2.0,2026-03-04
Chá,5.0,2026-03-04
Coca-Cola,2.0,2026-03-04
Couvert,7.0,2026-03-04
Delicia de Chocolate,1.0,2026-03-04
Doce da casa,5.0,2026-03-04
ES Ortigão Nektar,1.0,2026-03-04
Filetes Peixe Galo,9.5,2026-03-04
Filetes de Polvo,2.5,2026-03-04
Fino,14.0,2026-03-04
Maça Assada,2.0,2026-03-04
Melão com Presunto,2.0,2026-03-04
Menu Dia,8.0,2026-03-04
Mouse,2.0,2026-03-04
Pera Bêbada,2.0,2026-03-04
Posta,1.0,2026-03-04
Prato do dia Carne,4.0,2026-03-04
Prato do dia Peixe,12.0,2026-03-04
Prego,1.0,2026-03-04
Pudim,1.0,2026-03-04
Queijo Couvert,1.0,2026-03-04
Sopa,2.0,2026-03-04
Sopa de Peixe,1.0,2026-03-04
TT Dona Matilde Res,2.0,2026-03-04
Take Away,5.0,2026-03-04
Tostas de Rabo de Boi,2.0,2026-03-04
Vegetariano,1.0,2026-03-04
Vinho 0.5L,4.0,2026-03-04
Vinho 1L,1.0,2026-03-04
Vinho Branco da casa (copo),2.0,2026-03-04
Vinho Tinto da casa (copo),1.0,2026-03-04
Água 0.5L,5.0,2026-03-04
Arroz Doce,1.0,2026-03-05
Arroz de Tamboril,2.0,2026-03-05
Bacalhau à Brás,1.0,2026-03-05
Bebida Dia,18.0,2026-03-05
Bife Lombo,2.0,2026-03-05
Bife de Atum,1.0,2026-03-05
Café,52.0,2026-03-05
Caldo Verde,1.0,2026-03-05
Couvert,5.0,2026-03-05
Delicia de Chocolate,1.0,2026-03-05
Dourada/Robalo Grelhado,2.0,2026-03-05
Fino,3.0,2026-03-05
Fruta,2.0,2026-03-05
Maça Assada,3.0,2026-03-05
Menu 35€,39.0,2026-03-05
Menu Dia,18.0,2026-03-05
"Menu Dia,Prato do dia Carne,Bebida Dia",1.33,2026-03-05
Mouse,1.0,2026-03-05
Polvo à Lagareiro,1.0,2026-03-05
Prato do dia Carne,14.0,2026-03-05
Prato do dia Peixe,6.0,2026-03-05
Pudim,1.0,2026-03-05
Queijo Couvert,1.0,2026-03-05
Take Away,1.0,2026-03-05
Vegetariano,1.0,2026-03-05
Vinho 0.5L,2.0,2026-03-05
Vinho 1L,2.0,2026-03-05
Vinho Branco da casa (copo),5.0,2026-03-05
Vinho Menu,26.0,2026-03-05
Vinho Tinto da casa (copo),1.0,2026-03-05
Água 0.5L,1.0,2026-03-05
Água Menu,2.0,2026-03-05
Água c/gás,5.0,2026-03-05
Arroz Doce,1.0,2026-03-06
BR Papa Figos,1.0,2026-03-06
Bacalhau à Lagareiro,1.0,2026-03-06
Bebida Dia,6.0,2026-03-06
Bife de Atum,3.0,2026-03-06
Café,14.0,2026-03-06
Couvert,8.0,2026-03-06
Doce da casa,2.0,2026-03-06
Entrecôte,1.0,2026-03-06
Filetes Peixe Galo,14.5,2026-03-06
Filetes de Polvo,10.5,2026-03-06
Fino,5.0,2026-03-06
Legumes Salteados,1.0,2026-03-06
Massada de Peixe,1.0,2026-03-06
Menu Dia,3.0,2026-03-06
Mouse,1.0,2026-03-06
Picanha,1.0,2026-03-06
Polvo à Lagareiro,3.0,2026-03-06
Prato do dia Peixe,6.0,2026-03-06
Pudim,2.0,2026-03-06
Sopa de Peixe,5.0,2026-03-06
TT Monte Peceguinha,1.0,2026-03-06
TT V.Nídeo Reserva,2.0,2026-03-06
Take Away,1.0,2026-03-06
Vinho 0.5L,2.0,2026-03-06
Vinho Branco da casa (copo),2.0,2026-03-06
Vinho Tinto da casa (copo),1.0,2026-03-06
Água 0.5L,9.0,2026-03-06
Água Ardente,1.0,2026-03-06
Arroz Doce,1.0,2026-03-07
Azeitonas,1.0,2026-03-07
BR Duvalley,2.0,2026-03-07
BR Duvalley Reserva,1.0,2026-03-07
BR Luis Pato Maria Gomes,2.0,2026-03-07
BR Luis Pato Vinhas Velhas,1.0,2026-03-07
BR Qta Portal Moscatel,1.0,2026-03-07
BR Ribeiro Santo Encruzado,2.0,2026-03-07
Bacalhau à Lagareiro,1.0,2026-03-07
Bacalhau à Narcisa,7.0,2026-03-07
Beirão,2.0,2026-03-07
Bife Lombo,2.0,2026-03-07
Bife de Atum,1.0,2026-03-07
Bolinhas Alheira (6 Un.),2.0,2026-03-07
Café,42.0,2026-03-07
Carne de Porco à Alentejana,2.0,2026-03-07
Cesto de Pão,5.0,2026-03-07
Coca-Cola,13.0,2026-03-07
Couvert,17.0,2026-03-07
Cozido à Portuguesa,10.0,2026-03-07
Doce da casa,16.0,2026-03-07
Dourada/Robalo Grelhado,2.0,2026-03-07
Entrecôte,1.0,2026-03-07
Filetes Peixe Galo,21.0,2026-03-07
Filetes de Polvo,11.0,2026-03-07
Fino,11.0,2026-03-07
Fruta Tropical,1.0,2026-03-07
Ice Tea,3.0,2026-03-07
Jack Daniels,3.0,2026-03-07
Magret de Pato,1.0,2026-03-07
Martini,2.0,2026-03-07
Maça Assada,6.0,2026-03-07
Mouse,6.0,2026-03-07
Pera Bêbada,3.0,2026-03-07
Pica-pau,1.0,2026-03-07
Picanha,2.0,2026-03-07
Polvo à Lagareiro,2.0,2026-03-07
Posta,3.0,2026-03-07
Pudim,3.0,2026-03-07
Seven Up,1.0,2026-03-07
Sopa,4.0,2026-03-07
Sopa de Peixe,2.0,2026-03-07
TT Duvalley,1.0,2026-03-07
TT Ribeiro Santo colheita,2.0,2026-03-07
Take Away,2.0,2026-03-07
Tostas de Rabo de Boi,5.0,2026-03-07
V Muralhas,1.0,2026-03-07
Vinho 0.5L,8.0,2026-03-07
Vinho Branco da casa (copo),3.0,2026-03-07
Vinho Tinto da casa (copo),3.0,2026-03-07
Água 0.5L,14.0,2026-03-07
Água c/gás,1.0,2026-03-07
Azeitonas,1.0,2026-03-09
BR Ribeiro Santo Encruzado,1.0,2026-03-09
Bebida Dia,14.0,2026-03-09
Bife de Atum,1.0,2026-03-09
Café,6.0,2026-03-09
Caldo Verde,1.0,2026-03-09
Coca-Cola,1.0,2026-03-09
Couvert,4.0,2026-03-09
Delicia de Chocolate,2.0,2026-03-09
Doce da casa,1.0,2026-03-09
Entrecôte,1.0,2026-03-09
Filetes Peixe Galo,3.5,2026-03-09
Filetes de Polvo,0.5,2026-03-09
Fino,1.0,2026-03-09
Ice Tea,3.0,2026-03-09
Menu Dia,7.0,2026-03-09
Prato do dia Carne,4.0,2026-03-09
Prato do dia Peixe,10.0,2026-03-09
Take Away,1.0,2026-03-09
Tostas de Rabo de Boi,2.0,2026-03-09
Vinho Branco da casa (copo),1.0,2026-03-09
Ameijoas à Bulhão Pato,1.0,2026-03-10
Arroz Conquilhas,1.0,2026-03-10
Arroz de Rabo de Boi,2.0,2026-03-10
Azeitonas,1.0,2026-03-10
BR Papa Figos,1.0,2026-03-10
Bacalhau à Brás,1.0,2026-03-10
Bacalhau à Lagareiro,5.0,2026-03-10
Batata dose,1.0,2026-03-10
Bebida Dia,6.0,2026-03-10
Bife Lombo,1.0,2026-03-10
Café,13.0,2026-03-10
Camarao ao alho,1.0,2026-03-10
Cesto de Pão,1.0,2026-03-10
Coca-Cola,2.0,2026-03-10
Couvert,8.0,2026-03-10
Coxa de Pato Confitada,1.0,2026-03-10
Delicia de Chocolate,1.0,2026-03-10
Dourada/Robalo Grelhado,3.0,2026-03-10
Entrecôte,2.0,2026-03-10
Filetes Peixe Galo,9.0,2026-03-10
Filetes de Polvo,1.0,2026-03-10
Fino,7.0,2026-03-10
Menu 25€,7.0,2026-03-10
Menu Degustação Simples,14.0,2026-03-10
Menu Dia,3.0,2026-03-10
Mouse,2.0,2026-03-10
Ovos Rotos,1.0,2026-03-10
Picanha,1.0,2026-03-10
Polvo à Lagareiro,1.0,2026-03-10
Prato do dia Carne,4.0,2026-03-10
Prato do dia Peixe,2.0,2026-03-10
Queijo Couvert,3.0,2026-03-10
Salada,1.0,2026-03-10
Sopa,2.0,2026-03-10
Sopa de Peixe,4.0,2026-03-10
TT Vinha Grande,1.0,2026-03-10
Vinho 0.5L,5.0,2026-03-10
Vinho Menu,14.0,2026-03-10
Água 0.5L,15.0,2026-03-10
BR GALHARDINI,4.0,2026-03-11
Bacalhau à Brás,3.0,2026-03-11
Bacalhau à Lagareiro,1.0,2026-03-11
Bebida Dia,38.0,2026-03-11
Bife de Atum,2.0,2026-03-11
Bolinhas Alheira (6 Un.),1.0,2026-03-11
Brandy Croft,2.0,2026-03-11
Café,20.0,2026-03-11
Caldo Verde,1.0,2026-03-11
Carne de Porco à Alentejana,1.0,2026-03-11
Cesto de Pão,1.0,2026-03-11
Chá,1.0,2026-03-11
Coca-Cola,5.0,2026-03-11
Couvert,8.0,2026-03-11
Delicia de Chocolate,1.0,2026-03-11
Doce da casa,1.0,2026-03-11
Dourada/Robalo Grelhado,2.0,2026-03-11
Entrecôte,3.0,2026-03-11
Filetes Peixe Galo,2.0,2026-03-11
Fino,10.0,2026-03-11
Fruta,2.0,2026-03-11
Menu 25€,2.0,2026-03-11
Menu Degustação Simples,4.0,2026-03-11
Menu Dia,42.0,2026-03-11
"Menu Dia,Prato do dia Carne,Bebida Dia",8.0,2026-03-11
Mouse,2.0,2026-03-11
Ovos Rotos,1.0,2026-03-11
Pera Bêbada,5.0,2026-03-11
Picanha,1.0,2026-03-11
Prato do dia Carne,36.0,2026-03-11
Prato do dia Peixe,14.0,2026-03-11
Pudim,2.0,2026-03-11
Queijo Couvert,1.0,2026-03-11
Sopa de Peixe,1.0,2026-03-11
TT Monte Peceguinha,2.0,2026-03-11
Take Away,1.0,2026-03-11
Tostas de Rabo de Boi,1.0,2026-03-11
Vinho 0.5L,1.0,2026-03-11
Vinho Branco da casa (copo),5.0,2026-03-11
Vinho Menu,4.0,2026-03-11
Vinho Tinto da casa (copo),1.0,2026-03-11
Água 0.5L,2.0,2026-03-11
Água Menu,12.0,2026-03-11
Arroz de Tamboril,1.0,2026-03-12
Azeitonas,1.0,2026-03-12
BR Luis Pato Maria Gomes,1.0,2026-03-12
Bacalhau à Brás,2.0,2026-03-12
Batata dose,1.0,2026-03-12
Bebida Dia,12.0,2026-03-12
Café,8.0,2026-03-12
Caldo Verde,2.0,2026-03-12
Cesto de Pão,2.0,2026-03-12
Chouriço Assado,1.0,2026-03-12
Coca-Cola,1.0,2026-03-12
Couvert,6.0,2026-03-12
Delicia de Chocolate,2.0,2026-03-12
Dourada/Robalo Grelhado,1.0,2026-03-12
Entrecôte,1.0,2026-03-12
Filetes Peixe Galo,3.0,2026-03-12
Filetes de Polvo,2.0,2026-03-12
Fino,4.0,2026-03-12
Maça Assada,1.0,2026-03-12
Menu Dia,10.0,2026-03-12
Mouse,3.0,2026-03-12
Pera Bêbada,5.0,2026-03-12
Polvo Ensalsado,1.0,2026-03-12
Polvo à Lagareiro,1.0,2026-03-12
Prato do dia Carne,6.0,2026-03-12
Prato do dia Peixe,14.0,2026-03-12
Pudim,2.0,2026-03-12
Queijo Couvert,1.0,2026-03-12
Salada,1.0,2026-03-12
Sopa,2.0,2026-03-12
Tostas de Rabo de Boi,2.0,2026-03-12
Vegetariano,1.0,2026-03-12
Vinho 0.5L,2.0,2026-03-12
Vinho Branco da casa (copo),3.0,2026-03-12
Água 0.5L,9.0,2026-03-12
Água Menu,8.0,2026-03-12
Água c/gás,3.0,2026-03-12
Arroz de Rabo de Boi,1.0,2026-03-13
BR Duvalley Reserva,1.0,2026-03-13
BR Monte Peceguinha,4.0,2026-03-13
BR Ribeiro Santo Encruzado,2.0,2026-03-13
Bacalhau à Brás,4.0,2026-03-13
Bacalhau à Lagareiro,1.0,2026-03-13
Bebida Dia,26.0,2026-03-13
Bife Lombo,2.0,2026-03-13
Bolinhas de Alheira (3 Un.),1.0,2026-03-13
CRF-Reserva,3.0,2026-03-13
Café,22.0,2026-03-13
Caldo Verde,1.0,2026-03-13
Camarao ao alho,1.0,2026-03-13
Carne de Porco à Alentejana,1.0,2026-03-13
Cesto de Pão,1.0,2026-03-13
Chouriço Assado,2.0,2026-03-13
Coca-Cola,5.0,2026-03-13
Couvert,10.0,2026-03-13
Coxa de Pato Confitada,1.0,2026-03-13
Doce da casa,6.0,2026-03-13
Dourada/Robalo Grelhado,1.0,2026-03-13
Entrecôte,2.0,2026-03-13
Filetes Peixe Galo,9.5,2026-03-13
Filetes de Polvo,13.5,2026-03-13
Fino,8.0,2026-03-13
Ice Tea,1.0,2026-03-13
Maça Assada,2.0,2026-03-13
Menu Dia,13.0,2026-03-13
Mini Sagres,33.0,2026-03-13
Mouse,4.0,2026-03-13
Pera Bêbada,6.0,2026-03-13
Polvo à Lagareiro,2.0,2026-03-13
Prato do dia Carne,18.0,2026-03-13
Prato do dia Peixe,8.0,2026-03-13
Pudim,1.0,2026-03-13
Sangria 1.5L,1.0,2026-03-13
Seven Up,1.0,2026-03-13
Sopa,1.0,2026-03-13
Sopa de Peixe,6.0,2026-03-13
Take Away,3.0,2026-03-13
Tostas de Rabo de Boi,4.0,2026-03-13
Vinho 1L,1.0,2026-03-13
Vinho Branco da casa (copo),2.0,2026-03-13
Vinho Tinto da casa (copo),1.0,2026-03-13
Água 0.5L,1.0,2026-03-13
Água c/gás,5.0,2026-03-13
Ameijoas à Bulhão Pato,1.0,2026-03-14
Arroz de Polvo,4.0,2026-03-14
Arroz de Rabo de Boi,2.0,2026-03-14
Azeitonas,2.0,2026-03-14
BR Monte Peceguinha,3.0,2026-03-14
Bacalhau à Brás,1.0,2026-03-14
Bacalhau à Lagareiro,1.0,2026-03-14
Bacalhau à Narcisa,2.0,2026-03-14
Bife Lombo,1.0,2026-03-14
Bife de Atum,4.0,2026-03-14
Café,23.0,2026-03-14
Cesto de Pão,2.0,2026-03-14
Coca-Cola,1.0,2026-03-14
Couvert,10.0,2026-03-14
Coxa de Pato Confitada,2.0,2026-03-14
Cozido à Portuguesa,12.0,2026-03-14
Doce da casa,3.0,2026-03-14
Dourada/Robalo Grelhado,2.0,2026-03-14
Filetes Peixe Galo,14.0,2026-03-14
Filetes de Polvo,1.0,2026-03-14
Fino,3.0,2026-03-14
Ice Tea,1.0,2026-03-14
Maça Assada,2.0,2026-03-14
Mouse,1.0,2026-03-14
Ovos Rotos,1.0,2026-03-14
Pera Bêbada,2.0,2026-03-14
Pica-Pau Terra e Mar,1.0,2026-03-14
Posta,2.0,2026-03-14
Pudim,2.0,2026-03-14
Queijo Couvert,1.0,2026-03-14
RS Papa Figos,2.0,2026-03-14
Salada,1.0,2026-03-14
Sopa de Peixe,3.0,2026-03-14
TT Papa Figos,1.0,2026-03-14
TT Vinha Grande,1.0,2026-03-14
Take Away,7.0,2026-03-14
Taça de Gelado,2.0,2026-03-14
Tostas de Rabo de Boi,2.0,2026-03-14
Vinho 0.5L,5.0,2026-03-14
Vinho 1L,2.0,2026-03-14
Vinho Tinto da casa (copo),1.0,2026-03-14
Água 0.5L,10.0,2026-03-14
Água c/gás,4.0,2026-03-14
Ameijoas à Bulhão Pato,3.0,2026-03-16
Arroz de Lavagante,1.0,2026-03-16
Arroz de Polvo,1.0,2026-03-16
Azeitonas,1.0,2026-03-16
BR Monte Peceguinha,3.0,2026-03-16
Bacalhau à Brás,1.0,2026-03-16
Batata dose,1.0,2026-03-16
Bebida Dia,20.0,2026-03-16
Bife Lombo,2.0,2026-03-16
Bolinhas Alheira (6 Un.),2.0,2026-03-16
Café,15.0,2026-03-16
Caldo Verde,1.0,2026-03-16
Camarao ao alho,2.0,2026-03-16
Cesto de Pão,7.0,2026-03-16
Coca-Cola,3.0,2026-03-16
Couvert,8.0,2026-03-16
Coxa de Pato Confitada,1.0,2026-03-16
Doce da casa,4.0,2026-03-16
Dourada/Robalo Grelhado,4.0,2026-03-16
Filetes Peixe Galo,15.5,2026-03-16
Filetes de Polvo,4.0,2026-03-16
Fino,3.0,2026-03-16
Fruta Tropical,3.0,2026-03-16
Magret de Pato,1.0,2026-03-16
Maça Assada,1.0,2026-03-16
Menu Dia,21.33,2026-03-16
Mouse,1.0,2026-03-16
Pera Bêbada,2.0,2026-03-16
Picanha,2.0,2026-03-16
Polvo Ensalsado,1.0,2026-03-16
Prato do dia Carne,12.0,2026-03-16
Prato do dia Peixe,10.0,2026-03-16
Prego,2.0,2026-03-16
Queijo Couvert,2.0,2026-03-16
Sopa,2.0,2026-03-16
Sopa de Peixe,2.0,2026-03-16
TT Galhardini,1.0,2026-03-16
Take Away,4.0,2026-03-16
Vinho 0.5L,7.0,2026-03-16
Vinho Branco da casa (copo),3.0,2026-03-16
Vinho Tinto da casa (copo),1.0,2026-03-16
Água 0.5L,9.0,2026-03-16
Água Menu,2.0,2026-03-16
Água c/gás,2.0,2026-03-16
Arroz Doce,7.0,2026-03-17
Azeitonas,1.0,2026-03-17
BR Ribeiro Santo Encruzado,1.0,2026-03-17
Bebida Dia,6.0,2026-03-17
Café,9.0,2026-03-17
Cesto de Pão,1.0,2026-03-17
Couvert,5.0,2026-03-17
Filetes Peixe Galo,1.0,2026-03-17
Filetes de Polvo,1.0,2026-03-17
Fino,1.0,2026-03-17
Menu 25€,7.0,2026-03-17
Menu Degustação Simples,14.0,2026-03-17
Menu Dia,11.0,2026-03-17
Prato do dia Carne,8.0,2026-03-17
Prato do dia Peixe,14.0,2026-03-17
Queijo Couvert,1.0,2026-03-17
Sopa,1.0,2026-03-17
TT Dona Matilde,2.0,2026-03-17
Vinho Menu,14.0,2026-03-17
Água Menu,16.0,2026-03-17
Água c/gás,1.0,2026-03-17
Arroz Doce,1.0,2026-03-18
Arroz de Rabo de Boi,1.0,2026-03-18
Bacalhau à Brás,2.0,2026-03-18
Bebida Dia,10.0,2026-03-18
Bolinhas Alheira (6 Un.),1.0,2026-03-18
Café,12.0,2026-03-18
Caldo Verde,1.0,2026-03-18
Coca-Cola,2.0,2026-03-18
Couvert,5.0,2026-03-18
Doce da casa,1.0,2026-03-18
ES Quinta Monteirinhos,1.0,2026-03-18
Filetes Peixe Galo,4.0,2026-03-18
Filetes de Polvo,0.5,2026-03-18
Ice Tea,1.0,2026-03-18
Maça Assada,3.0,2026-03-18
Menu Dia,9.0,2026-03-18
Mouse,1.0,2026-03-18
Pera Bêbada,2.0,2026-03-18
Porto Ferreira Tawny,1.0,2026-03-18
Prato do dia Carne,10.0,2026-03-18
Prato do dia Peixe,8.0,2026-03-18
Pudim,1.0,2026-03-18
Queijo Couvert,1.0,2026-03-18
Sopa de Peixe,3.0,2026-03-18
TT Dona Matilde Res,1.0,2026-03-18
TT Monte Peceguinha,1.0,2026-03-18
Take Away,3.0,2026-03-18
Tostas de Rabo de Boi,2.0,2026-03-18
Vinho Branco da casa (copo),1.0,2026-03-18
Vinho Tinto da casa (copo),1.0,2026-03-18
Água 0.5L,6.0,2026-03-18
Água Menu,8.0,2026-03-18
Arroz Doce,1.0,2026-03-19
Azeitonas,1.0,2026-03-19
BR Papa Figos,1.0,2026-03-19
Bacalhau à Brás,1.0,2026-03-19
Bebida Dia,12.0,2026-03-19
Bolinhas Alheira (6 Un.),1.0,2026-03-19
Bolinhas de Alheira (3 Un.),1.0,2026-03-19
Café,20.0,2026-03-19
Caldo Verde,1.0,2026-03-19
Carne de Porco à Alentejana,2.0,2026-03-19
Cesto de Pão,1.0,2026-03-19
Coca-Cola,5.0,2026-03-19
Couvert,10.0,2026-03-19
Coxa de Pato Confitada,1.0,2026-03-19
Doce da casa,4.0,2026-03-19
Entrecôte,2.0,2026-03-19
Filetes Peixe Galo,7.0,2026-03-19
Filetes de Polvo,5.0,2026-03-19
Fino,4.0,2026-03-19
Magret de Pato,2.0,2026-03-19
Manteiga,2.0,2026-03-19
Maça Assada,1.0,2026-03-19
Menu Dia,10.0,2026-03-19
Mini Sagres,1.0,2026-03-19
Mouse,3.0,2026-03-19
Pera Bêbada,2.0,2026-03-19
Polvo à Lagareiro,1.0,2026-03-19
Prato do dia Carne,10.0,2026-03-19
Prato do dia Peixe,10.0,2026-03-19
Pudim,6.0,2026-03-19
Sopa,4.0,2026-03-19
Sopa de Marisco,1.0,2026-03-19
Sopa de Peixe,2.0,2026-03-19
Take Away,2.0,2026-03-19
Tostas de Rabo de Boi,1.0,2026-03-19
V Muralhas,1.0,2026-03-19
Vinho 0.5L,6.0,2026-03-19
Vinho 1L,1.0,2026-03-19
Vinho Branco da casa (copo),2.0,2026-03-19
Vinho Tinto da casa (copo),2.0,2026-03-19
Água 0.5L,5.0,2026-03-19
Água Menu,8.0,2026-03-19
Arroz Doce,1.0,2026-03-20
Azeitonas,1.0,2026-03-20
Bacalhau à Brás,1.0,2026-03-20
Bacalhau à Lagareiro,2.0,2026-03-20
Bebida Dia,14.0,2026-03-20
Bife Lombo,1.0,2026-03-20
Bife de Atum,1.0,2026-03-20
CRF-Reserva,2.0,2026-03-20
Café,22.0,2026-03-20
Camarao ao alho,1.0,2026-03-20
Camarão da Costa,1.0,2026-03-20
Cesto de Pão,1.0,2026-03-20
Chá,1.0,2026-03-20
Coca-Cola,1.0,2026-03-20
Couvert,11.0,2026-03-20
Coxa de Pato Confitada,1.0,2026-03-20
Delicia de Chocolate,1.0,2026-03-20
Doce da casa,9.0,2026-03-20
Entrecôte,1.0,2026-03-20
Filetes Peixe Galo,8.0,2026-03-20
Filetes de Polvo,3.5,2026-03-20
Fino,10.0,2026-03-20
Fruta Tropical,1.0,2026-03-20
Ice Tea,2.0,2026-03-20
Legumes Salteados,1.0,2026-03-20
Magret de Pato,1.0,2026-03-20
Maça Assada,2.0,2026-03-20
Menu Dia,17.0,2026-03-20
"Menu Dia,Prato do dia Peixe,Bebida Dia",1.0,2026-03-20
Mouse,5.0,2026-03-20
Polvo à Lagareiro,2.0,2026-03-20
Posta,1.0,2026-03-20
Prato do dia Carne,8.0,2026-03-20
Prato do dia Peixe,10.0,2026-03-20
Pudim,3.0,2026-03-20
Seven Up,1.0,2026-03-20
TT Duvalley Reserva,1.0,2026-03-20
TT Monte Peceguinha,1.0,2026-03-20
Take Away,2.0,2026-03-20
Tostas de Rabo de Boi,1.0,2026-03-20
V Regueiro,2.0,2026-03-20
Vinho 0.5L,2.0,2026-03-20
Vinho Branco da casa (copo),1.0,2026-03-20
Vinho Tinto da casa (copo),3.0,2026-03-20
Água 0.5L,4.0,2026-03-20
Água Menu,4.0,2026-03-20
Água c/gás,1.0,2026-03-20
Alheira,1.0,2026-03-21
Arroz Doce,1.0,2026-03-21
Arroz de Pato,4.0,2026-03-21
Arroz de Polvo,1.0,2026-03-21
Arroz de Rabo de Boi,3.0,2026-03-21
BR Burmester meia gr.,1.0,2026-03-21
BR Luis Pato Vinhas Velhas,2.0,2026-03-21
Bacalhau à Lagareiro,2.0,2026-03-21
Bacalhau à Narcisa,7.0,2026-03-21
Bife Lombo,3.0,2026-03-21
Bife de Atum,1.0,2026-03-21
Café,27.0,2026-03-21
Caldo Verde,1.0,2026-03-21
Carne de Porco à Alentejana,1.0,2026-03-21
Cerveja S/Alcool,2.0,2026-03-21
Cesto de Pão,2.0,2026-03-21
Coca-Cola,6.0,2026-03-21
Couvert,12.0,2026-03-21
Coxa de Pato Confitada,1.0,2026-03-21
Cozido à Portuguesa,7.0,2026-03-21
Doce da casa,9.0,2026-03-21
Dourada/Robalo Grelhado,1.0,2026-03-21
Entrecôte,2.0,2026-03-21
Filetes Peixe Galo,3.0,2026-03-21
Fino,21.0,2026-03-21
Fruta Tropical,2.0,2026-03-21
Ice Tea,2.0,2026-03-21
Legumes Salteados,1.0,2026-03-21
Magret de Pato,5.0,2026-03-21
Manteiga,2.0,2026-03-21
Maça Assada,5.0,2026-03-21
Moscatel,2.0,2026-03-21
Mouse,5.0,2026-03-21
Ovos Rotos,1.0,2026-03-21
Pera Bêbada,4.0,2026-03-21
Pica-Pau Terra e Mar,1.0,2026-03-21
Picanha,4.0,2026-03-21
Posta,1.0,2026-03-21
Pudim,3.0,2026-03-21
Salada,1.0,2026-03-21
Sopa,3.0,2026-03-21
Sopa de Peixe,3.0,2026-03-21
TT Monte Peceguinha,1.0,2026-03-21
TT Papa Figos,1.0,2026-03-21
Take Away,3.0,2026-03-21
Vinho 0.5L,6.0,2026-03-21
Vinho 1L,1.0,2026-03-21
Vinho Branco da casa (copo),2.0,2026-03-21
Vinho Tinto da casa (copo),3.0,2026-03-21
Água 0.5L,8.0,2026-03-21
Água c/gás,6.0,2026-03-21
Aliança XO 10 anos,2.0,2026-03-23
Ameijoas à Bulhão Pato,5.0,2026-03-23
Arroz Doce,2.0,2026-03-23
Arroz de Polvo,3.0,2026-03-23
BR Papa Figos,2.0,2026-03-23
BR Qta Portal Moscatel,4.0,2026-03-23
BR Ribeiro Santo Encruzado,1.0,2026-03-23
BR Vinha Grande,2.0,2026-03-23
Bacalhau à Brás,1.0,2026-03-23
Bebida Dia,6.0,2026-03-23
Bife Lombo,1.0,2026-03-23
Bolinhas Alheira (6 Un.),1.0,2026-03-23
Brandy Croft,1.0,2026-03-23
Café,28.0,2026-03-23
Camarao ao alho,3.0,2026-03-23
Chouriço Assado,1.0,2026-03-23
Chá,1.0,2026-03-23
Coca-Cola,5.0,2026-03-23
Couvert,11.0,2026-03-23
Doce da casa,7.0,2026-03-23
Entrecôte,5.0,2026-03-23
Filetes Peixe Galo,19.5,2026-03-23
Filetes de Polvo,11.5,2026-03-23
Fino,1.0,2026-03-23
Jack Daniels,2.0,2026-03-23
Maça Assada,2.0,2026-03-23
Menu Dia,12.0,2026-03-23
Mouse,1.0,2026-03-23
Ovos Rotos,1.0,2026-03-23
Pera Bêbada,2.0,2026-03-23
Pica-Pau Terra e Mar,1.0,2026-03-23
Polvo à Lagareiro,2.0,2026-03-23
Prato do dia Carne,8.0,2026-03-23
Prato do dia Peixe,16.0,2026-03-23
Queijo Couvert,1.0,2026-03-23
Sopa de Peixe,1.0,2026-03-23
TT Galhardini,1.0,2026-03-23
TT S. Domingos Reserva,1.0,2026-03-23
Take Away,4.0,2026-03-23
Vinho 0.5L,1.0,2026-03-23
Vinho 1L,1.0,2026-03-23
Vinho Tinto da casa (copo),1.0,2026-03-23
Água 0.5L,16.0,2026-03-23
Água Menu,18.0,2026-03-23
Água c/gás,4.0,2026-03-23
Azeitonas,1.0,2026-03-24
Batata dose,1.0,2026-03-24
Bebida Dia,12.0,2026-03-24
Café,3.0,2026-03-24
Caldo Verde,1.0,2026-03-24
Carne de Porco à Alentejana,1.0,2026-03-24
Couvert,4.0,2026-03-24
Doce da casa,1.0,2026-03-24
Entrecôte,1.0,2026-03-24
Filetes de Polvo,3.5,2026-03-24
Fino,2.0,2026-03-24
Magret de Pato,1.0,2026-03-24
Maça Assada,1.0,2026-03-24
Menu 25€,6.0,2026-03-24
Menu Degustação Simples,12.0,2026-03-24
Menu Dia,7.0,2026-03-24
Moscatel,1.0,2026-03-24
Mouse,1.0,2026-03-24
Pica-Pau Terra e Mar,1.0,2026-03-24
Prato do dia Carne,2.0,2026-03-24
Prato do dia Peixe,12.0,2026-03-24
Pudim,1.0,2026-03-24
Sopa,2.0,2026-03-24
TT Vinha Grande,1.0,2026-03-24
Take Away,1.0,2026-03-24
Vinho 0.5L,1.0,2026-03-24
Vinho Branco da casa (copo),1.0,2026-03-24
Vinho Menu,12.0,2026-03-24
Água 0.5L,1.0,2026-03-24
Água Menu,2.0,2026-03-24
Água c/gás,1.0,2026-03-24
Arroz de Polvo,3.0,2026-03-25
BR Luis Pato Maria Gomes,1.0,2026-03-25
Bacalhau à Lagareiro,3.0,2026-03-25
Bebida Dia,16.0,2026-03-25
Bife de Atum,2.0,2026-03-25
Bolinhas Alheira (6 Un.),1.0,2026-03-25
Café,24.0,2026-03-25
Camarao ao alho,1.0,2026-03-25
Carne de Porco à Alentejana,2.0,2026-03-25
Couvert,11.0,2026-03-25
Delicia de Chocolate,7.0,2026-03-25
Doce da casa,2.0,2026-03-25
Dourada/Robalo Grelhado,2.0,2026-03-25
Filetes Peixe Galo,11.0,2026-03-25
Filetes de Polvo,9.5,2026-03-25
Fino,4.0,2026-03-25
Fruta,1.0,2026-03-25
Ice Tea,2.0,2026-03-25
Menu Dia,8.0,2026-03-25
Mouse,3.0,2026-03-25
Pera Bêbada,1.0,2026-03-25
Pica-Pau Terra e Mar,1.0,2026-03-25
Polvo à Lagareiro,1.0,2026-03-25
Prato do dia Carne,8.0,2026-03-25
Prato do dia Peixe,8.0,2026-03-25
Sangria 1L,1.0,2026-03-25
Sangria Espumante 1.5L,1.0,2026-03-25
Sopa de Peixe,2.0,2026-03-25
Take Away,1.0,2026-03-25
V Muralhas,1.0,2026-03-25
Vegetariano,1.0,2026-03-25
Vinho 0.5L,6.0,2026-03-25
Vinho 1L,3.0,2026-03-25
Vinho Branco da casa (copo),1.0,2026-03-25
Água 0.5L,2.0,2026-03-25
Água c/gás,2.0,2026-03-25
Batata dose,1.0,2026-03-26
Bebida Dia,14.0,2026-03-26
Bife Lombo,1.0,2026-03-26
Café,10.0,2026-03-26
Caldo Verde,1.0,2026-03-26
Camarão costa (Peq.),1.0,2026-03-26
Carne de Porco à Alentejana,1.0,2026-03-26
Cesto de Pão,1.0,2026-03-26
Coca-Cola,14.0,2026-03-26
Couvert,12.0,2026-03-26
Doce da casa,5.0,2026-03-26
Dourada/Robalo Grelhado,1.0,2026-03-26
Entrecôte,17.0,2026-03-26
Filetes Peixe Galo,29.5,2026-03-26
Filetes de Polvo,0.5,2026-03-26
Fruta,1.0,2026-03-26
Fruta Tropical,2.0,2026-03-26
Ice Tea,1.0,2026-03-26
Maça Assada,3.0,2026-03-26
Menu Dia,13.0,2026-03-26
Mouse,9.0,2026-03-26
Pica-pau,1.0,2026-03-26
Prato do dia Carne,8.0,2026-03-26
Prato do dia Peixe,18.0,2026-03-26
Pudim,5.0,2026-03-26
Queijo Couvert,1.0,2026-03-26
Tostas de Rabo de Boi,2.0,2026-03-26
Vinho 0.5L,1.0,2026-03-26
Vinho 1L,2.0,2026-03-26
Vinho Branco da casa (copo),5.0,2026-03-26
Vinho Tinto da casa (copo),1.0,2026-03-26
Água 0.5L,8.0,2026-03-26
Água Menu,12.0,2026-03-26
Ameijoas à Bulhão Pato,3.0,2026-03-27
Arroz de Lavagante,1.0,2026-03-27
Arroz de Rabo de Boi,2.0,2026-03-27
Arroz de Tamboril,5.0,2026-03-27
Azeitonas,1.0,2026-03-27
BR Papa Figos,1.0,2026-03-27
BR Ribeiro Santo Encruzado,5.0,2026-03-27
BR Vinha Grande,2.0,2026-03-27
Bacalhau à Lagareiro,3.0,2026-03-27
Batata dose,1.0,2026-03-27
Bebida Dia,10.0,2026-03-27
Bife de Atum,1.0,2026-03-27
Bolinhas Alheira (6 Un.),3.0,2026-03-27
Café,34.0,2026-03-27
Camarao ao alho,2.0,2026-03-27
Camarão da Costa,1.0,2026-03-27
Coca-Cola,9.0,2026-03-27
Couvert,18.0,2026-03-27
Doce da casa,9.0,2026-03-27
Entrecôte,2.0,2026-03-27
Filetes Peixe Galo,30.5,2026-03-27
Filetes de Polvo,1.5,2026-03-27
Fino,16.0,2026-03-27
Fruta Tropical,1.0,2026-03-27
J.Walker Black 12 anos,6.0,2026-03-27
Maça Assada,1.0,2026-03-27
Menu Dia,8.0,2026-03-27
Mouse,2.0,2026-03-27
Pera Bêbada,2.0,2026-03-27
Pica-pau,1.0,2026-03-27
Polvo à Lagareiro,2.0,2026-03-27
Prato do dia Carne,10.0,2026-03-27
Prato do dia Peixe,6.0,2026-03-27
Pudim,5.0,2026-03-27
RS Papa Figos,1.0,2026-03-27
Seven Up,1.0,2026-03-27
Sopa de Marisco,2.0,2026-03-27
Sopa de Peixe,4.0,2026-03-27
TT Dez Tostões,1.0,2026-03-27
TT Monte Peceguinha,1.0,2026-03-27
TT S. Domingos Reserva,1.0,2026-03-27
Take Away,3.0,2026-03-27
Vinho 0.5L,2.0,2026-03-27
Vinho Branco da casa (copo),4.0,2026-03-27
Água 0.5L,14.0,2026-03-27
Água Menu,6.0,2026-03-27
Água c/gás,1.0,2026-03-27
Alheira,1.0,2026-03-28
Ameijoas à Bulhão Pato,1.0,2026-03-28
Amendoa Amarga,1.0,2026-03-28
Arroz Doce,2.0,2026-03-28
Arroz de Lingueirão,2.0,2026-03-28
Arroz de Polvo,1.0,2026-03-28
Arroz de Tamboril,2.0,2026-03-28
Arroz dose,1.0,2026-03-28
BR Volupia,3.0,2026-03-28
Bacalhau à Brás,5.0,2026-03-28
Bacalhau à Lagareiro,2.0,2026-03-28
Bebida Dia,4.0,2026-03-28
Beirão,5.0,2026-03-28
Bife de Atum,1.0,2026-03-28
Bolinhas Alheira (6 Un.),1.0,2026-03-28
Café,16.0,2026-03-28
Caldo Verde,2.0,2026-03-28
Camarão da Costa,1.0,2026-03-28
Carne de Porco à Alentejana,1.0,2026-03-28
Cesto de Pão,2.0,2026-03-28
Chá,1.0,2026-03-28
Coca-Cola,2.0,2026-03-28
Couvert,10.0,2026-03-28
Cozido à Portuguesa,2.0,2026-03-28
Doce da casa,5.0,2026-03-28
Dourada/Robalo Grelhado,4.0,2026-03-28
Entrecôte,3.0,2026-03-28
Feijão Preto,1.0,2026-03-28
Filetes Peixe Galo,4.0,2026-03-28
Filetes de Polvo,1.0,2026-03-28
Fino,7.0,2026-03-28
Fruta,1.0,2026-03-28
Legumes Salteados,1.0,2026-03-28
Maça Assada,1.0,2026-03-28
Menu Dia,3.0,2026-03-28
Mini Sagres,5.0,2026-03-28
Mouse,1.0,2026-03-28
Omelete Camarão,1.0,2026-03-28
Ovos Rotos,2.0,2026-03-28
Pera Bêbada,3.0,2026-03-28
Pica-pau,1.0,2026-03-28
Polvo à Lagareiro,1.0,2026-03-28
Posta,1.0,2026-03-28
Prato do dia Carne,2.0,2026-03-28
Prato do dia Peixe,4.0,2026-03-28
Salada,2.0,2026-03-28
Sandwich Club,1.0,2026-03-28
Sopa,1.0,2026-03-28
Sopa de Marisco,2.0,2026-03-28
Sopa de Peixe,1.0,2026-03-28
TT Monte Peceguinha,1.0,2026-03-28
Take Away,3.0,2026-03-28
Tostas de Rabo de Boi,8.0,2026-03-28
Vegetariano,1.0,2026-03-28
Vinho 0.5L,4.0,2026-03-28
Vinho 1L,2.0,2026-03-28
Vinho Branco da casa (copo),2.0,2026-03-28
Água 0.5L,13.0,2026-03-28
Água Menu,2.0,2026-03-28
Água c/gás,4.0,2026-03-28
Arroz Doce,1.0,2026-03-30
BR Piano Moscatel Galego,1.0,2026-03-30
BR Ribeiro Santo Encruzado,1.0,2026-03-30
Bacalhau à Brás,1.0,2026-03-30
Bacalhau à Lagareiro,4.0,2026-03-30
Batata dose,1.0,2026-03-30
Bebida Dia,30.0,2026-03-30
Bife de Atum,3.0,2026-03-30
Café,23.0,2026-03-30
Caldo Verde,2.0,2026-03-30
Camarao ao alho,1.0,2026-03-30
Carne de Porco à Alentejana,1.0,2026-03-30
Coca-Cola,6.0,2026-03-30
Couvert,11.0,2026-03-30
Doce da casa,3.0,2026-03-30
Entrecôte,3.0,2026-03-30
Filetes Peixe Galo,4.0,2026-03-30
Filetes de Polvo,2.0,2026-03-30
Fino,7.0,2026-03-30
Fruta,1.0,2026-03-30
Fruta Tropical,7.0,2026-03-30
Maça Assada,1.0,2026-03-30
Menu Dia,17.0,2026-03-30
Mouse,3.0,2026-03-30
Omelete Camarão,1.0,2026-03-30
Pica-Pau Terra e Mar,1.0,2026-03-30
Picanha,2.0,2026-03-30
Polvo Ensalsado,1.0,2026-03-30
Polvo à Lagareiro,1.0,2026-03-30
Prato do dia Carne,10.0,2026-03-30
Prato do dia Peixe,24.0,2026-03-30
Pudim,2.0,2026-03-30
Queijo Couvert,2.0,2026-03-30
Sopa,1.0,2026-03-30
Sopa de Marisco,1.0,2026-03-30
Sopa de Peixe,5.0,2026-03-30
TT Dona Matilde Res,3.0,2026-03-30
Take Away,3.0,2026-03-30
Vinho 1L,1.0,2026-03-30
Vinho Branco da casa (copo),2.0,2026-03-30
Vinho Tinto da casa (copo),1.0,2026-03-30
Água 0.5L,10.0,2026-03-30
Água Menu,4.0,2026-03-30
Água c/gás,2.0,2026-03-30
Ameijoas à Bulhão Pato,2.0,2026-03-31
Arroz Doce,1.0,2026-03-31
Arroz de Tamboril,1.0,2026-03-31
Azeitonas,1.0,2026-03-31
BR Ribeiro Santo Encruzado,1.0,2026-03-31
Bacalhau à Lagareiro,5.0,2026-03-31
Batata dose,1.0,2026-03-31
Bebida Dia,12.0,2026-03-31
Beirão,5.0,2026-03-31
Bife de Atum,1.0,2026-03-31
Bolinhas Alheira (6 Un.),2.0,2026-03-31
Bombay,3.0,2026-03-31
CRF-Reserva,1.0,2026-03-31
Café,17.0,2026-03-31
Camarao ao alho,1.0,2026-03-31
Carne de Porco à Alentejana,1.0,2026-03-31
Cesto de Pão,1.0,2026-03-31
Chouriço Assado,3.0,2026-03-31
Coca-Cola,4.0,2026-03-31
Compal Néctar,1.0,2026-03-31
Couvert,9.0,2026-03-31
Doce da casa,2.0,2026-03-31
Dourada/Robalo Grelhado,3.0,2026-03-31
ES Ortigão Nektar,1.0,2026-03-31
Entrecôte,1.0,2026-03-31
Filetes Peixe Galo,3.0,2026-03-31
Filetes de Polvo,1.0,2026-03-31
Fino,7.0,2026-03-31
Fruta Tropical,1.0,2026-03-31
Magret de Pato,2.0,2026-03-31
Maça Assada,3.0,2026-03-31
Menu 25€,8.0,2026-03-31
"Menu 25€,Menu Degustação Simples,Vinho Menu",9.0,2026-03-31
Menu Degustação Simples,18.0,2026-03-31
Menu Dia,10.0,2026-03-31
Moscatel,1.0,2026-03-31
Mouse,2.0,2026-03-31
Pera Bêbada,3.0,2026-03-31
Picanha,2.0,2026-03-31
Polvo à Lagareiro,1.0,2026-03-31
Prato do dia Carne,6.0,2026-03-31
Prato do dia Peixe,14.0,2026-03-31
Pudim,2.0,2026-03-31
Queijo Couvert,2.0,2026-03-31
Salada,1.0,2026-03-31
Seven Up,1.0,2026-03-31
Sopa de Peixe,4.0,2026-03-31
TT Vinha Grande,1.0,2026-03-31
V Muralhas,1.0,2026-03-31
Vinho Branco da casa (copo),1.0,2026-03-31
Vinho Menu,18.0,2026-03-31
Vinho Tinto da casa (copo),1.0,2026-03-31
Água 0.5L,6.0,2026-03-31
Água Ardente,1.0,2026-03-31
Água Menu,8.0,2026-03-31
Água c/gás,7.0,2026-03-31
Ameijoas à Bulhão Pato,3.0,2026-04-01
Arroz de Polvo,2.0,2026-04-01
Arroz de Rabo de Boi,1.0,2026-04-01
Arroz de Tamboril,1.0,2026-04-01
BR Papa Figos,1.0,2026-04-01
Bacalhau à Brás,1.0,2026-04-01
Bebida Dia,10.0,2026-04-01
Bolinhas Alheira (6 Un.),1.0,2026-04-01
Bolinhas de Alheira (3 Un.),1.0,2026-04-01
Café,29.0,2026-04-01
Caldo Verde,2.0,2026-04-01
Camarao ao alho,2.0,2026-04-01
Carne de Porco à Alentejana,9.0,2026-04-01
Cesto de Pão,4.0,2026-04-01
Coca-Cola,9.0,2026-04-01
Compal Néctar,1.0,2026-04-01
Couvert,15.0,2026-04-01
Coxa de Pato Confitada,1.0,2026-04-01
Doce da casa,6.0,2026-04-01
Dourada/Robalo Grelhado,2.0,2026-04-01
Entrecôte,1.0,2026-04-01
Filetes Peixe Galo,7.0,2026-04-01
Filetes de Polvo,6.0,2026-04-01
Fino,8.0,2026-04-01
Fruta Tropical,2.0,2026-04-01
Ice Tea,2.0,2026-04-01
Magret de Pato,1.0,2026-04-01
Maça Assada,1.0,2026-04-01
Menu Dia,5.0,2026-04-01
Mouse,5.0,2026-04-01
Ovos Rotos,1.0,2026-04-01
Pera Bêbada,2.0,2026-04-01
Picanha,11.0,2026-04-01
Polvo à Lagareiro,2.0,2026-04-01
Prato do dia Carne,4.0,2026-04-01
Prato do dia Peixe,6.0,2026-04-01
Pudim,1.0,2026-04-01
Sangria 1L,1.0,2026-04-01
Seven Up,1.0,2026-04-01
Sopa de Peixe,3.0,2026-04-01
TT V.Nídeo Reserva,1.0,2026-04-01
Take Away,2.0,2026-04-01
V Regueiro,1.0,2026-04-01
Vegetariano,1.0,2026-04-01
Vinho 0.5L,8.0,2026-04-01
Vinho Branco da casa (copo),2.0,2026-04-01
Água 0.5L,10.0,2026-04-01
Água c/gás,5.0,2026-04-01
Arroz de Rabo de Boi,1.0,2026-04-02
Azeitonas,1.0,2026-04-02
BR Monte Peceguinha,5.0,2026-04-02
BR Piano Moscatel Galego,1.0,2026-04-02
BR Ribeiro Santo Colheita,3.0,2026-04-02
Bacalhau à Lagareiro,1.0,2026-04-02
Bebida Dia,14.0,2026-04-02
CRF-Reserva,1.0,2026-04-02
Café,28.0,2026-04-02
Camarão da Costa,4.0,2026-04-02
Cesto de Pão,1.0,2026-04-02
Coca-Cola,7.0,2026-04-02
Couvert,10.0,2026-04-02
Doce da casa,10.0,2026-04-02
Dourada/Robalo Grelhado,1.0,2026-04-02
Entrecôte,6.0,2026-04-02
Filetes Peixe Galo,29.0,2026-04-02
Filetes de Polvo,5.5,2026-04-02
Fino,11.0,2026-04-02
Fruta Tropical,1.0,2026-04-02
Ice Tea,1.0,2026-04-02
Magret de Pato,1.0,2026-04-02
Martini,1.0,2026-04-02
Maça Assada,4.0,2026-04-02
Menu Dia,7.0,2026-04-02
Mini Sagres,32.0,2026-04-02
Mouse,6.0,2026-04-02
Pera Bêbada,6.0,2026-04-02
Picanha,2.0,2026-04-02
Prato do dia Carne,10.0,2026-04-02
Prato do dia Peixe,4.0,2026-04-02
Pudim,5.0,2026-04-02
Queijo Couvert,2.0,2026-04-02
Salada,1.0,2026-04-02
Sangria Espumante 1.5L,2.0,2026-04-02
Seven Up,1.0,2026-04-02
Sopa,1.0,2026-04-02
Sopa de Marisco,1.0,2026-04-02
Sopa de Peixe,15.0,2026-04-02
Take Away,2.0,2026-04-02
Taça de Gelado,1.0,2026-04-02
Vinho 0.5L,10.0,2026-04-02
Vinho Branco da casa (copo),2.0,2026-04-02
Água 0.5L,6.0,2026-04-02
Água c/gás,1.0,2026-04-02
Alheira,1.0,2026-04-03
Ameijoas à Bulhão Pato,3.0,2026-04-03
Arroz de Polvo,6.0,2026-04-03
Arroz de Tamboril,2.0,2026-04-03
Azeitonas,1.0,2026-04-03
BR Burmester meia gr.,1.0,2026-04-03
BR Ribeiro Santo Colheita,1.0,2026-04-03
BR Ribeiro Santo Encruzado,2.0,2026-04-03
Bacalhau à Lagareiro,3.0,2026-04-03
Beirão,2.0,2026-04-03
Bife Lombo,1.0,2026-04-03
Bife de Atum,4.0,2026-04-03
Café,26.0,2026-04-03
Camarao ao alho,1.0,2026-04-03
Carne de Porco à Alentejana,2.0,2026-04-03
Cesto de Pão,1.0,2026-04-03
Coca-Cola,7.0,2026-04-03
Compal Néctar,1.0,2026-04-03
Couvert,14.0,2026-04-03
Coxa de Pato Confitada,2.0,2026-04-03
Cozido à Portuguesa,2.0,2026-04-03
Doce da casa,6.0,2026-04-03
Dourada/Robalo Grelhado,1.0,2026-04-03
Entrecôte,2.0,2026-04-03
Filetes Peixe Galo,14.0,2026-04-03
Filetes de Polvo,2.0,2026-04-03
Fino,10.0,2026-04-03
Fruta,1.0,2026-04-03
Ice Tea,5.0,2026-04-03
Legumes Salteados,1.0,2026-04-03
Magret de Pato,2.0,2026-04-03
Manteiga,1.0,2026-04-03
Mouse,3.0,2026-04-03
Omelete Camarão,1.0,2026-04-03
Ovos Rotos,3.0,2026-04-03
Picanha,5.0,2026-04-03
Polvo à Lagareiro,3.0,2026-04-03
Pudim,5.0,2026-04-03
Salada,1.0,2026-04-03
Seven Up,1.0,2026-04-03
Sopa,6.0,2026-04-03
Sopa de Peixe,3.0,2026-04-03
TT Galhardini,1.0,2026-04-03
Take Away,1.0,2026-04-03
Tostas de Rabo de Boi,1.0,2026-04-03
Vinho 0.5L,5.0,2026-04-03
Vinho 1L,1.0,2026-04-03
Vinho Branco da casa (copo),4.0,2026-04-03
Vinho Tinto da casa (copo),1.0,2026-04-03
Água 0.5L,32.0,2026-04-03
Água c/gás,3.0,2026-04-03
Alheira,1.0,2026-04-04
Ameijoas à Bulhão Pato,2.0,2026-04-04
Amendoa Amarga,1.0,2026-04-04
Arroz de Pato,2.0,2026-04-04
Arroz de Polvo,2.0,2026-04-04
Arroz de Rabo de Boi,2.0,2026-04-04
Arroz de Tamboril,3.0,2026-04-04
Azeitonas,1.0,2026-04-04
BR Papa Figos,1.0,2026-04-04
BR Ribeiro Santo Encruzado,1.0,2026-04-04
BR Volupia,1.0,2026-04-04
Bacalhau à Brás,2.0,2026-04-04
Bacalhau à Lagareiro,2.0,2026-04-04
Bacalhau à Narcisa,2.0,2026-04-04
Beirão,3.0,2026-04-04
Bife de Atum,3.0,2026-04-04
Bolinhas Alheira (6 Un.),2.0,2026-04-04
Bolinhas de Alheira (3 Un.),1.0,2026-04-04
CRF-Reserva,4.0,2026-04-04
Café,30.0,2026-04-04
Carne de Porco à Alentejana,1.0,2026-04-04
Cesto de Pão,1.0,2026-04-04
Coca-Cola,3.0,2026-04-04
Couvert,13.0,2026-04-04
Cozido à Portuguesa,4.0,2026-04-04
Doce da casa,6.0,2026-04-04
Dourada/Robalo Grelhado,2.0,2026-04-04
ES Ortigão Nektar,1.0,2026-04-04
ES S. Domingos Extra Reserva,1.0,2026-04-04
Entrecôte,4.0,2026-04-04
Filetes Peixe Galo,15.0,2026-04-04
Fino,8.0,2026-04-04
Ice Tea,2.0,2026-04-04
Mini Sagres,2.0,2026-04-04
Mouse,9.0,2026-04-04
Omelete Camarão,3.0,2026-04-04
Pera Bêbada,1.0,2026-04-04
Pica-pau,1.0,2026-04-04
Picanha,2.0,2026-04-04
Polvo Ensalsado,1.0,2026-04-04
Pudim,1.0,2026-04-04
Queijo Couvert,1.0,2026-04-04
Salada,1.0,2026-04-04
Sangria 1.5L,2.0,2026-04-04
Sopa,3.0,2026-04-04
TT Burmester meia gr.,1.0,2026-04-04
TT Dona Matilde,1.0,2026-04-04
TT Titular Reserva,2.0,2026-04-04
Take Away,4.0,2026-04-04
Taça de Gelado,2.0,2026-04-04
Tostas de Rabo de Boi,6.0,2026-04-04
Vinho 0.5L,5.0,2026-04-04
Vinho 1L,1.0,2026-04-04
Vinho Tinto da casa (copo),2.0,2026-04-04
Água 0.5L,16.0,2026-04-04
Água c/gás,1.0,2026-04-04
Arroz de Rabo de Boi,1.0,2026-04-06
Arroz de Tamboril,1.0,2026-04-06
Azeitonas,3.0,2026-04-06
BR Monte Peceguinha,2.0,2026-04-06
BR Volupia,1.0,2026-04-06
Bacalhau à Lagareiro,1.0,2026-04-06
Bebida Dia,24.0,2026-04-06
Beirão,1.0,2026-04-06
Bife de Atum,2.0,2026-04-06
Bolinhas de Alheira (3 Un.),1.0,2026-04-06
Bushmills,1.0,2026-04-06
Café,24.0,2026-04-06
Caldo Verde,2.0,2026-04-06
Camarão da Costa,1.0,2026-04-06
Coca-Cola,5.0,2026-04-06
Couvert,12.0,2026-04-06
Doce da casa,4.0,2026-04-06
Dourada/Robalo Grelhado,1.0,2026-04-06
Filetes Peixe Galo,5.0,2026-04-06
Filetes de Polvo,5.0,2026-04-06
Fino,6.0,2026-04-06
Fruta,1.0,2026-04-06
Ice Tea,7.0,2026-04-06
Maça Assada,4.0,2026-04-06
Melão com Presunto,1.0,2026-04-06
Menu Dia,22.0,2026-04-06
Moscatel,5.0,2026-04-06
Mouse,2.0,2026-04-06
Pera Bêbada,3.0,2026-04-06
Picanha,8.0,2026-04-06
Polvo à Lagareiro,3.0,2026-04-06
Prato do dia Carne,16.0,2026-04-06
Prato do dia Peixe,28.0,2026-04-06
Prego,1.0,2026-04-06
Queijo Couvert,1.0,2026-04-06
RS Qta. Boa Esperança,1.0,2026-04-06
Sopa,2.0,2026-04-06
Sopa de Peixe,4.0,2026-04-06
TT Ribeiro Santo Res,2.0,2026-04-06
TT Titular Reserva,1.0,2026-04-06
Take Away,5.0,2026-04-06
Vinho 0.5L,2.0,2026-04-06
Vinho Branco da casa (copo),3.0,2026-04-06
Água 0.5L,4.0,2026-04-06
Água Menu,20.0,2026-04-06
Água c/gás,3.0,2026-04-06
Arroz de Polvo,1.0,2026-04-07
Azeitonas,1.0,2026-04-07
BR Ribeiro Santo Encruzado,1.0,2026-04-07
Bacalhau à Brás,2.0,2026-04-07
Bacalhau à Lagareiro,1.0,2026-04-07
Bebida Dia,38.0,2026-04-07
Café,44.0,2026-04-07
Camarão da Costa,1.0,2026-04-07
Carne de Porco à Alentejana,1.0,2026-04-07
Cesto de Pão,2.0,2026-04-07
Coca-Cola,3.0,2026-04-07
Couvert,3.0,2026-04-07
Dourada/Robalo Grelhado,4.0,2026-04-07
Filetes Peixe Galo,2.0,2026-04-07
Filetes de Polvo,1.0,2026-04-07
Fino,5.0,2026-04-07
Fruta Tropical,3.0,2026-04-07
Martini,1.0,2026-04-07
Menu 25€,5.0,2026-04-07
Menu 35€,45.0,2026-04-07
Menu Degustação Simples,10.0,2026-04-07
Menu Dia,4.0,2026-04-07
Mouse,1.0,2026-04-07
Prato do dia Carne,8.0,2026-04-07
Queijo Couvert,1.0,2026-04-07
Salada,1.0,2026-04-07
Sopa,6.0,2026-04-07
Tostas de Rabo de Boi,1.0,2026-04-07
V Muralhas,1.0,2026-04-07
Vinho Branco da casa (copo),1.0,2026-04-07
Vinho Menu,10.0,2026-04-07
Água 0.5L,3.0,2026-04-07
Água c/gás,1.0,2026-04-07
Ameijoas à Bulhão Pato,1.0,2026-04-08
BR Ribeiro Santo Encruzado,1.0,2026-04-08
Bacalhau à Brás,2.0,2026-04-08
Bebida Dia,18.0,2026-04-08
Bolinhas de Alheira (3 Un.),1.0,2026-04-08
Bombay,1.0,2026-04-08
Café,17.0,2026-04-08
Camarao ao alho,1.0,2026-04-08
Cesto de Pão,1.0,2026-04-08
Coca-Cola,1.0,2026-04-08
Couvert,9.0,2026-04-08
Doce da casa,1.0,2026-04-08
Entrecôte,1.0,2026-04-08
Filetes Peixe Galo,5.0,2026-04-08
Filetes de Polvo,1.0,2026-04-08
Fino,9.0,2026-04-08
Fruta Tropical,2.0,2026-04-08
Ice Tea,1.0,2026-04-08
Maça Assada,1.0,2026-04-08
Menu Dia,9.0,2026-04-08
Moscatel,2.0,2026-04-08
Mouse,1.0,2026-04-08
Ovos Rotos,2.0,2026-04-08
Pera Bêbada,1.0,2026-04-08
Picanha,1.0,2026-04-08
Polvo à Lagareiro,2.0,2026-04-08
Porto 10 anos Tawny,1.0,2026-04-08
Prato do dia Carne,8.0,2026-04-08
Prato do dia Peixe,10.0,2026-04-08
Queijo Couvert,2.0,2026-04-08
Salada,1.0,2026-04-08
Sangria 1.5L,1.0,2026-04-08
Sopa,1.0,2026-04-08
Sopa de Peixe,1.0,2026-04-08
Take Away,1.0,2026-04-08
Vinho 0.5L,3.0,2026-04-08
Vinho 1L,1.0,2026-04-08
Vinho Branco da casa (copo),3.0,2026-04-08
Água 0.5L,3.0,2026-04-08
Água c/gás,1.0,2026-04-08
Arroz de Tamboril,1.0,2026-04-09
Bacalhau à Brás,2.0,2026-04-09
Bebida Dia,12.0,2026-04-09
Café,15.0,2026-04-09
Carne de Porco à Alentejana,2.0,2026-04-09
Chá,1.0,2026-04-09
Coca-Cola,1.0,2026-04-09
Couvert,6.0,2026-04-09
Doce da casa,1.0,2026-04-09
Filetes Peixe Galo,1.0,2026-04-09
Filetes de Polvo,2.0,2026-04-09
Fino,3.0,2026-04-09
Ice Tea,1.0,2026-04-09
Menu Dia,6.0,2026-04-09
Mouse,3.0,2026-04-09
Picanha,2.0,2026-04-09
Prato do dia Carne,6.0,2026-04-09
Prato do dia Peixe,6.0,2026-04-09
Pudim,2.0,2026-04-09
Sopa,1.0,2026-04-09
Tostas de Rabo de Boi,5.0,2026-04-09
Vinho 0.5L,6.0,2026-04-09
Vinho Branco da casa (copo),1.0,2026-04-09
Vinho Tinto da casa (copo),1.0,2026-04-09
Água 0.5L,5.0,2026-04-09
Arroz de Rabo de Boi,1.0,2026-04-10
Azeitonas,1.0,2026-04-10
BR Duvalley Reserva,1.0,2026-04-10
BR Ribeiro Santo Encruzado,2.0,2026-04-10
BR Valle do Nídeo,1.0,2026-04-10
Bacalhau à Brás,2.0,2026-04-10
Batata dose,1.0,2026-04-10
Bebida Dia,2.0,2026-04-10
Bife de Atum,1.0,2026-04-10
Black Label,1.0,2026-04-10
Bolinhas de Alheira (3 Un.),1.0,2026-04-10
Café,14.0,2026-04-10
Carne de Porco à Alentejana,1.0,2026-04-10
Couvert,7.0,2026-04-10
Doce da casa,6.0,2026-04-10
Entrecôte,1.0,2026-04-10
Filetes Peixe Galo,9.0,2026-04-10
Filetes de Polvo,2.0,2026-04-10
Fino,4.0,2026-04-10
Fruta Tropical,1.0,2026-04-10
Menu Dia,1.0,2026-04-10
Mini Sagres,18.0,2026-04-10
Mouse,2.0,2026-04-10
Polvo Ensalsado,1.0,2026-04-10
Prato do dia Peixe,2.0,2026-04-10
Pudim,2.0,2026-04-10
Sangria 1.5L,1.0,2026-04-10
Sopa de Peixe,2.0,2026-04-10
TT Monte Peceguinha,1.0,2026-04-10
TT Papa Figos,2.0,2026-04-10
TT Ribeiro Santo Res,1.0,2026-04-10
TT Titular Reserva,1.0,2026-04-10
Take Away,2.0,2026-04-10
Taça de Gelado,1.0,2026-04-10
Tostas de Rabo de Boi,2.0,2026-04-10
Vinho Branco da casa (copo),2.0,2026-04-10
Água 0.5L,1.0,2026-04-10
Água c/gás,2.0,2026-04-10
Ameijoas à Bulhão Pato,3.0,2026-04-11
Arroz de Tamboril,7.0,2026-04-11
Azeitonas,2.0,2026-04-11
BR Luis Pato Vinhas Velhas,1.0,2026-04-11
BR Piano Moscatel Galego,2.0,2026-04-11
Bacalhau à Brás,6.0,2026-04-11
Bacalhau à Narcisa,5.0,2026-04-11
Bife de Atum,2.0,2026-04-11
Bolinhas Alheira (6 Un.),6.0,2026-04-11
CRF-Reserva,2.0,2026-04-11
Café,35.0,2026-04-11
Caldo Verde,3.0,2026-04-11
Carne de Porco à Alentejana,1.0,2026-04-11
Cesto de Pão,1.0,2026-04-11
Coca-Cola,11.0,2026-04-11
Compal Néctar,1.0,2026-04-11
Couvert,16.0,2026-04-11
Cozido à Portuguesa,1.0,2026-04-11
Doce da casa,15.0,2026-04-11
E S.Domingos,2.0,2026-04-11
Entrecôte,2.0,2026-04-11
Filetes Peixe Galo,36.5,2026-04-11
Filetes de Polvo,4.0,2026-04-11
Fino,14.0,2026-04-11
Ice Tea,1.0,2026-04-11
Martini,1.0,2026-04-11
Maça Assada,2.0,2026-04-11
Mouse,7.0,2026-04-11
Omelete Camarão,2.0,2026-04-11
Pera Bêbada,1.0,2026-04-11
Pudim,4.0,2026-04-11
Sopa,1.0,2026-04-11
Sopa de Peixe,2.0,2026-04-11
Take Away,3.0,2026-04-11
Taça de Gelado,1.0,2026-04-11
Tostas de Rabo de Boi,4.0,2026-04-11
Vinho 0.5L,4.0,2026-04-11
Vinho 1L,1.0,2026-04-11
Vinho Branco da casa (copo),3.0,2026-04-11
Vinho Tinto da casa (copo),1.0,2026-04-11
Água 0.5L,23.0,2026-04-11
Água c/gás,4.0,2026-04-11
Arroz de Polvo,1.0,2026-04-13
Arroz de Tamboril,3.0,2026-04-13
Azeitonas,1.0,2026-04-13
BR Planalto,1.0,2026-04-13
BR Ribeiro Santo Encruzado,3.0,2026-04-13
BR Volupia,1.0,2026-04-13
Batata dose,1.0,2026-04-13
Bebida Dia,22.0,2026-04-13
Café,16.0,2026-04-13
Caldo Verde,1.0,2026-04-13
Camarao ao alho,1.0,2026-04-13
Coca-Cola,2.0,2026-04-13
Couvert,8.0,2026-04-13
Doce da casa,6.0,2026-04-13
Filetes Peixe Galo,7.5,2026-04-13
Filetes de Polvo,7.0,2026-04-13
Fino,1.0,2026-04-13
Maça Assada,3.0,2026-04-13
Menu Dia,11.0,2026-04-13
Mouse,1.0,2026-04-13
Pica-Pau Terra e Mar,1.0,2026-04-13
Prato do dia Carne,6.0,2026-04-13
Prato do dia Peixe,16.0,2026-04-13
Salada,1.0,2026-04-13
Sopa de Peixe,7.0,2026-04-13
Take Away,4.0,2026-04-13
Vinho 0.5L,2.0,2026-04-13
Vinho 1L,1.0,2026-04-13
Vinho Branco da casa (copo),2.0,2026-04-13
Água 0.5L,5.0,2026-04-13
Arroz de Polvo,1.0,2026-04-14
Azeitonas,1.0,2026-04-14
BR Ribeiro Santo Encruzado,1.0,2026-04-14
Bacalhau à Brás,1.0,2026-04-14
Bacalhau à Lagareiro,1.0,2026-04-14
Bebida Dia,20.0,2026-04-14
Bolinhas Alheira (6 Un.),1.0,2026-04-14
Café,14.0,2026-04-14
Coca-Cola,1.0,2026-04-14
Couvert,6.0,2026-04-14
Doce da casa,1.0,2026-04-14
E Quinta Ortigão,1.0,2026-04-14
Entrecôte,1.0,2026-04-14
Filetes Peixe Galo,5.0,2026-04-14
Fino,1.0,2026-04-14
Menu 25€,6.0,2026-04-14
Menu Degustação Simples,12.0,2026-04-14
Menu Dia,10.0,2026-04-14
Polvo Ensalsado,1.0,2026-04-14
Polvo à Lagareiro,2.0,2026-04-14
Prato do dia Carne,6.0,2026-04-14
Prato do dia Peixe,14.0,2026-04-14
Pudim,2.0,2026-04-14
Queijo Couvert,1.0,2026-04-14
Salada,1.0,2026-04-14
TT Dona Matilde Res,1.0,2026-04-14
TT Galhardini,1.0,2026-04-14
Take Away,1.0,2026-04-14
V Muralhas,1.0,2026-04-14
Vinho Branco da casa (copo),2.0,2026-04-14
Vinho Menu,12.0,2026-04-14
Vinho Tinto da casa (copo),1.0,2026-04-14
Vinho do Porto (dose),1.0,2026-04-14
Água 0.5L,4.0,2026-04-14
BR Qta Lemos D.Paulette,1.0,2026-04-15
Bacalhau à Brás,1.0,2026-04-15
Bebida Dia,6.0,2026-04-15
Bife de Atum,1.0,2026-04-15
Café,8.0,2026-04-15
Camarao ao alho,1.0,2026-04-15
Coca-Cola,2.0,2026-04-15
Couvert,1.0,2026-04-15
Entrecôte,1.0,2026-04-15
Menu Dia,3.0,2026-04-15
Mouse,2.0,2026-04-15
Picanha,1.0,2026-04-15
Prato do dia Carne,4.0,2026-04-15
Prato do dia Peixe,2.0,2026-04-15
Queijo Couvert,1.0,2026-04-15
Salada,1.0,2026-04-15
Sopa de Peixe,1.0,2026-04-15
Take Away,1.0,2026-04-15
Vinho 0.5L,1.0,2026-04-15
Vinho Branco da casa (copo),1.0,2026-04-15
Vinho Tinto da casa (copo),1.0,2026-04-15
Água 0.5L,1.0,2026-04-15
Ameijoas à Bulhão Pato,2.0,2026-04-16
Arroz de Rabo de Boi,2.0,2026-04-16
Arroz de Tamboril,2.0,2026-04-16
BR Luis Pato Maria Gomes,2.0,2026-04-16
BR Monte Peceguinha,1.0,2026-04-16
Bayleys,1.0,2026-04-16
Bebida Dia,2.0,2026-04-16
Bife de Atum,1.0,2026-04-16
Bolinhas de Alheira (3 Un.),1.0,2026-04-16
Bombay,2.0,2026-04-16
Brandy Croft,1.0,2026-04-16
CRF-Reserva,1.0,2026-04-16
Café,13.0,2026-04-16
Caldo Verde,2.0,2026-04-16
Camarao ao alho,1.0,2026-04-16
Camarão da Costa,3.0,2026-04-16
Carne de Porco à Alentejana,1.0,2026-04-16
Cesto de Pão,2.0,2026-04-16
Chouriço Assado,1.0,2026-04-16
Coca-Cola,5.0,2026-04-16
Couvert,6.0,2026-04-16
Delicia de Chocolate,1.0,2026-04-16
Doce da casa,1.0,2026-04-16
ES S. Domingos Extra Reserva,1.0,2026-04-16
Entrecôte,2.0,2026-04-16
Filetes Peixe Galo,8.0,2026-04-16
Filetes de Polvo,2.0,2026-04-16
Fino,11.0,2026-04-16
Fruta,1.0,2026-04-16
Ice Tea,1.0,2026-04-16
Magret de Pato,1.0,2026-04-16
Massada de Peixe,1.0,2026-04-16
Menu Dia,1.0,2026-04-16
Mouse,1.0,2026-04-16
Pera Bêbada,3.0,2026-04-16
Picanha,1.0,2026-04-16
Prato do dia Peixe,2.0,2026-04-16
Pudim,1.0,2026-04-16
Seven Up,1.0,2026-04-16
Sopa,1.0,2026-04-16
Sopa de Peixe,3.0,2026-04-16
TT Papa Figos,1.0,2026-04-16
Take Away,4.0,2026-04-16
Vinho 0.5L,2.0,2026-04-16
Vinho Tinto da casa (copo),1.0,2026-04-16
Água 0.5L,7.0,2026-04-16
Água Ardente,1.0,2026-04-16
Água c/gás,3.0,2026-04-16
Arroz de Rabo de Boi,1.0,2026-04-17
Azeitonas,1.0,2026-04-17
BR GALHARDINI,1.0,2026-04-17
BR Ribeiro Santo Encruzado,1.0,2026-04-17
Bacalhau à Brás,1.0,2026-04-17
Bebida Dia,14.0,2026-04-17
Bife Lombo,1.0,2026-04-17
Café,4.0,2026-04-17
Camarão da Costa,2.0,2026-04-17
Carne de Porco à Alentejana,1.0,2026-04-17
Cesto de Pão,1.0,2026-04-17
Coca-Cola,2.0,2026-04-17
Couvert,5.0,2026-04-17
Doce da casa,1.0,2026-04-17
Entrecôte,1.0,2026-04-17
Filetes Peixe Galo,5.5,2026-04-17
Filetes de Polvo,1.0,2026-04-17
Fino,7.0,2026-04-17
Menu Dia,7.0,2026-04-17
Mini Sagres,10.0,2026-04-17
Mouse,2.0,2026-04-17
Pera Bêbada,1.0,2026-04-17
Prato do dia Peixe,14.0,2026-04-17
Pudim,1.0,2026-04-17
Sopa de Peixe,2.0,2026-04-17
TT Ribeiro Santo Res,1.0,2026-04-17
Take Away,4.0,2026-04-17
Tostas de Rabo de Boi,1.0,2026-04-17
Vinho Branco da casa (copo),1.0,2026-04-17
Água 0.5L,2.0,2026-04-17
Água c/gás,2.0,2026-04-17
Ameijoas à Bulhão Pato,1.0,2026-04-18
Arroz de Pato,6.0,2026-04-18
Arroz de Polvo,2.0,2026-04-18
Arroz de Rabo de Boi,2.0,2026-04-18
BR Duvalley,1.0,2026-04-18
BR Luis Pato Maria Gomes,1.0,2026-04-18
BR Vinha Grande,1.0,2026-04-18
BR Volupia,1.0,2026-04-18
Bacalhau à Brás,1.0,2026-04-18
Bacalhau à Narcisa,3.0,2026-04-18
Batata dose,3.0,2026-04-18
Bayleys,1.0,2026-04-18
Bebida Dia,2.0,2026-04-18
Bife Lombo,1.0,2026-04-18
Bife de Atum,8.0,2026-04-18
Black Label,1.0,2026-04-18
Bolinhas Alheira (6 Un.),1.0,2026-04-18
Bolinhas de Alheira (3 Un.),1.0,2026-04-18
Brandy Croft,1.0,2026-04-18
CRF-Reserva,1.0,2026-04-18
Café,36.0,2026-04-18
Camarao ao alho,2.0,2026-04-18
Cesto de Pão,6.0,2026-04-18
Coca-Cola,12.0,2026-04-18
Couvert,24.0,2026-04-18
Cozido à Portuguesa,11.0,2026-04-18
Delicia de Chocolate,1.0,2026-04-18
Doce da casa,5.0,2026-04-18
Dourada/Robalo Grelhado,3.0,2026-04-18
Entrecôte,2.0,2026-04-18
Filetes Peixe Galo,19.0,2026-04-18
Filetes de Polvo,5.5,2026-04-18
Fino,21.0,2026-04-18
Fruta Tropical,2.0,2026-04-18
Martini,3.0,2026-04-18
Martini Bianco,1.0,2026-04-18
Maça Assada,1.0,2026-04-18
Melão com Presunto,1.0,2026-04-18
Menu Dia,1.0,2026-04-18
Mouse,2.0,2026-04-18
Omelete Camarão,2.0,2026-04-18
Pera Bêbada,2.0,2026-04-18
Pica-Pau Terra e Mar,1.0,2026-04-18
Pica-pau,1.0,2026-04-18
Posta,1.0,2026-04-18
Prato do dia Carne,2.0,2026-04-18
Prego,1.0,2026-04-18
Pudim,2.0,2026-04-18
Queijo Couvert,1.0,2026-04-18
Salada,1.0,2026-04-18
Sangria 1.5L,2.0,2026-04-18
Sangria 1L,1.0,2026-04-18
Sangria Espumante 1.5L,1.0,2026-04-18
Seven Up,1.0,2026-04-18
Sopa,5.0,2026-04-18
Sopa de Peixe,1.0,2026-04-18
TT Galhardini,1.0,2026-04-18
TT Ribeiro Santo Res,1.0,2026-04-18
TT V.Nídeo Reserva,1.0,2026-04-18
Take Away,4.0,2026-04-18
Tostas de Rabo de Boi,1.0,2026-04-18
V Muralhas,1.0,2026-04-18
V Regueiro,1.0,2026-04-18
Vinho 0.5L,7.0,2026-04-18
Vinho 1L,2.0,2026-04-18
Vinho Branco da casa (copo),3.0,2026-04-18
Vinho Tinto da casa (copo),1.0,2026-04-18
Água 0.5L,21.0,2026-04-18
Água c/gás,2.0,2026-04-18
Arroz de Polvo,1.0,2026-04-20
Arroz de Rabo de Boi,1.0,2026-04-20
Arroz de Tamboril,2.0,2026-04-20
BR GALHARDINI,1.0,2026-04-20
BR Ribeiro Santo Encruzado,1.0,2026-04-20
Bacalhau à Brás,3.0,2026-04-20
Bacalhau à Lagareiro,1.0,2026-04-20
Bebida Dia,8.0,2026-04-20
Bife Lombo,1.0,2026-04-20
Bolinhas Alheira (6 Un.),2.0,2026-04-20
Café,14.0,2026-04-20
Carne de Porco à Alentejana,2.0,2026-04-20
Cesto de Pão,1.0,2026-04-20
Coca-Cola,5.0,2026-04-20
Couvert,11.0,2026-04-20
Doce da casa,5.0,2026-04-20
Entrecôte,1.0,2026-04-20
Filetes Peixe Galo,7.0,2026-04-20
Filetes de Polvo,2.0,2026-04-20
Fino,16.0,2026-04-20
Ice Tea,3.0,2026-04-20
Maça Assada,1.0,2026-04-20
Menu Dia,5.0,2026-04-20
Mouse,2.0,2026-04-20
Omelete Camarão,2.0,2026-04-20
Pera Bêbada,1.0,2026-04-20
Picanha,4.0,2026-04-20
Polvo Ensalsado,1.0,2026-04-20
Polvo à Lagareiro,2.0,2026-04-20
Prato do dia Carne,2.0,2026-04-20
Prato do dia Peixe,8.0,2026-04-20
Pudim,1.0,2026-04-20
Seven Up,4.0,2026-04-20
Sopa de Marisco,2.0,2026-04-20
Sopa de Peixe,1.0,2026-04-20
Take Away,5.0,2026-04-20
Vinho 0.5L,2.0,2026-04-20
Vinho 1L,2.0,2026-04-20
Vinho Tinto da casa (copo),1.0,2026-04-20
Água 0.5L,6.0,2026-04-20
Água Menu,2.0,2026-04-20
Água c/gás,6.0,2026-04-20
Arroz de Lingueirão,1.0,2026-04-21
Arroz de Rabo de Boi,1.0,2026-04-21
BR Piano Moscatel Galego,1.0,2026-04-21
BR Qta Portal Moscatel,2.0,2026-04-21
BR Ribeiro Santo Encruzado,1.0,2026-04-21
Bacalhau à Narcisa,1.0,2026-04-21
Bebida Dia,12.0,2026-04-21
Café,12.0,2026-04-21
Camarao ao alho,2.0,2026-04-21
Camarão costa (Peq.),1.0,2026-04-21
Camarão da Costa,3.0,2026-04-21
Cesto de Pão,1.0,2026-04-21
Chouriço Assado,1.0,2026-04-21
Coca-Cola,1.0,2026-04-21
Couvert,8.0,2026-04-21
Delicia de Chocolate,1.0,2026-04-21
Entrecôte,3.0,2026-04-21
Filetes Peixe Galo,6.0,2026-04-21
Filetes de Polvo,3.0,2026-04-21
Legumes Salteados,1.0,2026-04-21
Manteiga,1.0,2026-04-21
Maça Assada,1.0,2026-04-21
Menu 25€,6.0,2026-04-21
Menu Degustação Simples,12.0,2026-04-21
Menu Dia,6.0,2026-04-21
Mouse,3.0,2026-04-21
Pera Bêbada,1.0,2026-04-21
Pica-pau,1.0,2026-04-21
Prato do dia Carne,10.0,2026-04-21
Prato do dia Peixe,2.0,2026-04-21
Pudim,1.0,2026-04-21
Queijo Couvert,1.0,2026-04-21
Salada,1.0,2026-04-21
TT Monte Peceguinha,1.0,2026-04-21
TT V.Nídeo Reserva,1.0,2026-04-21
Take Away,3.0,2026-04-21
Tostas de Rabo de Boi,2.0,2026-04-21
Vinho 0.5L,2.0,2026-04-21
Vinho Branco da casa (copo),1.0,2026-04-21
Vinho Menu,12.0,2026-04-21
Água 0.5L,3.0,2026-04-21
BR GALHARDINI,1.0,2026-04-22
BR Ribeiro Santo Encruzado,2.0,2026-04-22
Bacalhau à Brás,1.0,2026-04-22
Bacalhau à Lagareiro,2.0,2026-04-22
Bebida Dia,20.0,2026-04-22
Café,7.0,2026-04-22
Camarao ao alho,2.0,2026-04-22
Carne de Porco à Alentejana,1.0,2026-04-22
Cesto de Pão,2.0,2026-04-22
Coca-Cola,2.0,2026-04-22
Compal Néctar,1.0,2026-04-22
Couvert,7.0,2026-04-22
Delicia de Chocolate,1.0,2026-04-22
Doce da casa,2.0,2026-04-22
Entrecôte,1.0,2026-04-22
Filetes Peixe Galo,11.5,2026-04-22
Filetes de Polvo,5.5,2026-04-22
Fino,12.0,2026-04-22
Maça Assada,3.0,2026-04-22
Menu Dia,10.0,2026-04-22
Mouse,6.0,2026-04-22
Pera Bêbada,1.0,2026-04-22
Polvo à Lagareiro,1.0,2026-04-22
Prato do dia Carne,12.0,2026-04-22
Prato do dia Peixe,8.0,2026-04-22
Prego,4.0,2026-04-22
Sopa de Peixe,3.0,2026-04-22
Take Away,4.0,2026-04-22
Tostas de Rabo de Boi,4.0,2026-04-22
Vinho 0.5L,1.0,2026-04-22
Vinho 1L,2.0,2026-04-22
Vinho Branco da casa (copo),2.0,2026-04-22
Água 0.5L,4.0,2026-04-22
Água c/gás,3.0,2026-04-22
Arroz de Polvo,1.0,2026-04-23
Bacalhau à Brás,1.0,2026-04-23
Bacalhau à Lagareiro,1.0,2026-04-23
Bebida Dia,10.0,2026-04-23
Café,12.0,2026-04-23
Caldo Verde,1.0,2026-04-23
Carne de Porco à Alentejana,1.0,2026-04-23
Cesto de Pão,1.0,2026-04-23
Couvert,6.0,2026-04-23
Doce da casa,2.0,2026-04-23
Dourada/Robalo Grelhado,1.0,2026-04-23
Entrecôte,1.0,2026-04-23
Filetes Peixe Galo,2.0,2026-04-23
Filetes de Polvo,2.0,2026-04-23
Fino,1.0,2026-04-23
Fruta,1.0,2026-04-23
Jack Daniels,2.0,2026-04-23
Legumes Salteados,1.0,2026-04-23
Maça Assada,1.0,2026-04-23
Menu Dia,5.0,2026-04-23
Mini Sagres,2.0,2026-04-23
Mouse,1.0,2026-04-23
Ovo estrelado,3.0,2026-04-23
Ovos Rotos,2.0,2026-04-23
Pera Bêbada,1.0,2026-04-23
Pica-pau,1.0,2026-04-23
Polvo Ensalsado,1.0,2026-04-23
Prato do dia Carne,2.0,2026-04-23
Prato do dia Peixe,8.0,2026-04-23
Queijo Couvert,1.0,2026-04-23
Salada,1.0,2026-04-23
Sopa de Marisco,1.0,2026-04-23
Sopa de Peixe,1.0,2026-04-23
TT Monte Peceguinha,1.0,2026-04-23
Vinho 0.5L,2.0,2026-04-23
Vinho Branco da casa (copo),1.0,2026-04-23
Água 0.5L,7.0,2026-04-23
Água c/gás,2.0,2026-04-23
Ameijoas à Bulhão Pato,1.0,2026-04-24
Arroz de Rabo de Boi,1.0,2026-04-24
Arroz de Tamboril,2.0,2026-04-24
BR GALHARDINI,1.0,2026-04-24
BR Luis Pato Maria Gomes,1.0,2026-04-24
BR Ribeiro Santo Encruzado,2.0,2026-04-24
Bacalhau à Lagareiro,2.0,2026-04-24
Bebida Dia,4.0,2026-04-24
Bife de Atum,1.0,2026-04-24
Café,12.0,2026-04-24
Caldo Verde,2.0,2026-04-24
Camarão costa (Peq.),1.0,2026-04-24
Camarão da Costa,1.0,2026-04-24
Carne de Porco à Alentejana,3.0,2026-04-24
Cesto de Pão,1.0,2026-04-24
Coca-Cola,3.0,2026-04-24
Compal Néctar,1.0,2026-04-24
Couvert,8.0,2026-04-24
Delicia de Chocolate,2.0,2026-04-24
Doce da casa,1.0,2026-04-24
Dourada/Robalo Grelhado,10.0,2026-04-24
Entrecôte,1.0,2026-04-24
Filetes Peixe Galo,7.0,2026-04-24
Filetes de Polvo,4.0,2026-04-24
Fruta,1.0,2026-04-24
Ice Tea,3.0,2026-04-24
Magret de Pato,1.0,2026-04-24
Manteiga,1.0,2026-04-24
Menu Dia,4.0,2026-04-24
Mini Sagres,8.0,2026-04-24
Moscatel,2.0,2026-04-24
Mouse,3.0,2026-04-24
Ovos Rotos,1.0,2026-04-24
Pera Bêbada,1.0,2026-04-24
Polvo Ensalsado,1.0,2026-04-24
Polvo à Lagareiro,1.0,2026-04-24
Prato do dia Carne,6.0,2026-04-24
Prato do dia Peixe,2.0,2026-04-24
Pudim,3.0,2026-04-24
Queijo Couvert,1.0,2026-04-24
Sopa,1.0,2026-04-24
Sopa de Marisco,1.0,2026-04-24
Sopa de Peixe,4.0,2026-04-24
TT Monte Peceguinha,4.0,2026-04-24
Vinho 0.5L,3.0,2026-04-24
Vinho Branco da casa (copo),2.0,2026-04-24
Água 0.5L,5.0,2026-04-24
Água Menu,4.0,2026-04-24
Água c/gás,5.0,2026-04-24
Ameijoas à Bulhão Pato,2.0,2026-04-25
Arroz de Rabo de Boi,1.0,2026-04-25
Arroz de Tamboril,1.0,2026-04-25
BR Planalto,1.0,2026-04-25
BR Ribeiro Santo Encruzado,1.0,2026-04-25
Bacalhau à Brás,1.0,2026-04-25
Bacalhau à Narcisa,3.0,2026-04-25
Bebida Dia,2.0,2026-04-25
Bife Lombo,1.0,2026-04-25
Bolinhas Alheira (6 Un.),1.0,2026-04-25
Bushmills,2.0,2026-04-25
Café,18.0,2026-04-25
Caldo Verde,1.0,2026-04-25
Carne de Porco à Alentejana,1.0,2026-04-25
Coca-Cola,6.0,2026-04-25
Compal Néctar,1.0,2026-04-25
Couvert,8.0,2026-04-25
Cozido à Portuguesa,3.0,2026-04-25
Delicia de Chocolate,2.0,2026-04-25
Doce da casa,4.0,2026-04-25
Dourada/Robalo Grelhado,1.0,2026-04-25
Filetes Peixe Galo,19.5,2026-04-25
Fino,13.0,2026-04-25
Menu Dia,1.0,2026-04-25
Mouse,2.0,2026-04-25
Ovos Rotos,1.0,2026-04-25
Pera Bêbada,1.0,2026-04-25
Polvo Ensalsado,1.0,2026-04-25
Porto 10 anos Tawny,1.0,2026-04-25
Prato do dia Carne,2.0,2026-04-25
Prego,2.0,2026-04-25
Sopa,4.0,2026-04-25
Take Away,3.0,2026-04-25
Vinho 0.5L,2.0,2026-04-25
Água 0.33L,1.0,2026-04-25
Água 0.5L,6.0,2026-04-25
Ameijoas à Bulhão Pato,1.0,2026-04-27
Arroz Doce,1.0,2026-04-27
Arroz de Tamboril,1.0,2026-04-27
BR GALHARDINI,1.0,2026-04-27
Batata dose,2.0,2026-04-27
Bebida Dia,18.0,2026-04-27
Café,12.0,2026-04-27
Camarão costa (Peq.),2.0,2026-04-27
Cesto de Pão,2.0,2026-04-27
Coca-Cola,3.0,2026-04-27
Couvert,6.0,2026-04-27
Doce da casa,6.0,2026-04-27
Filetes Peixe Galo,5.5,2026-04-27
Filetes de Polvo,3.5,2026-04-27
Fino,5.0,2026-04-27
Ice Tea,1.0,2026-04-27
Manteiga,2.0,2026-04-27
Menu Dia,12.0,2026-04-27
Mini Sagres,2.0,2026-04-27
Mouse,2.0,2026-04-27
Ovo estrelado,1.0,2026-04-27
Picanha,1.0,2026-04-27
Polvo Ensalsado,1.0,2026-04-27
Prato do dia Carne,8.0,2026-04-27
Prato do dia Peixe,16.0,2026-04-27
Pudim,1.0,2026-04-27
Salada,3.0,2026-04-27
Sopa de Marisco,2.0,2026-04-27
Sopa de Peixe,2.0,2026-04-27
Take Away,2.0,2026-04-27
Vinho 0.5L,1.0,2026-04-27
Água 0.5L,5.0,2026-04-27
Água Menu,6.0,2026-04-27
Água c/gás,1.0,2026-04-27
Arroz Doce,1.0,2026-04-28
Arroz de Tamboril,2.0,2026-04-28
BR Luis Pato Maria Gomes,1.0,2026-04-28
BR Monte Peceguinha,1.0,2026-04-28
BR Volupia,2.0,2026-04-28
Bacalhau à Brás,1.0,2026-04-28
Bacalhau à Lagareiro,1.0,2026-04-28
Batata dose,2.0,2026-04-28
Bebida Dia,12.0,2026-04-28
Bife de Atum,1.0,2026-04-28
Black Label,4.0,2026-04-28
Café,10.0,2026-04-28
Camarao ao alho,1.0,2026-04-28
Camarão costa (Peq.),1.0,2026-04-28
Cesto de Pão,1.0,2026-04-28
Chouriço Assado,1.0,2026-04-28
Coca-Cola,8.0,2026-04-28
Couvert,11.0,2026-04-28
Doce da casa,3.0,2026-04-28
Entrecôte,2.0,2026-04-28
Filetes Peixe Galo,7.5,2026-04-28
Filetes de Polvo,7.5,2026-04-28
Fino,10.0,2026-04-28
Fruta,1.0,2026-04-28
Ice Tea,2.0,2026-04-28
Magret de Pato,1.0,2026-04-28
Manteiga,1.0,2026-04-28
Menu 25€,6.0,2026-04-28
Menu Degustação Simples,12.0,2026-04-28
Menu Dia,6.0,2026-04-28
Mouse,1.0,2026-04-28
Ovo estrelado,1.0,2026-04-28
Pera Bêbada,1.0,2026-04-28
Pica-Pau Terra e Mar,1.0,2026-04-28
Polvo Ensalsado,1.0,2026-04-28
Posta,1.0,2026-04-28
Prato do dia Carne,10.0,2026-04-28
Prato do dia Peixe,2.0,2026-04-28
Queijo Couvert,1.0,2026-04-28
Salada,1.0,2026-04-28
Sopa,1.0,2026-04-28
Sopa de Marisco,1.0,2026-04-28
Sopa de Peixe,1.0,2026-04-28
TT Vinha Grande,1.0,2026-04-28
Take Away,2.0,2026-04-28
Tostas de Rabo de Boi,3.0,2026-04-28
V Regueiro,1.0,2026-04-28
Vinho 0.5L,1.0,2026-04-28
Vinho Branco da casa (copo),1.0,2026-04-28
Vinho Menu,12.0,2026-04-28
Água 0.5L,5.0,2026-04-28
Arroz Doce,1.0,2026-04-29
Arroz de Rabo de Boi,1.0,2026-04-29
BR GALHARDINI,1.0,2026-04-29
BR Papa Figos,1.0,2026-04-29
Bacalhau à Brás,2.0,2026-04-29
Bacalhau à Lagareiro,2.0,2026-04-29
Bebida Dia,30.0,2026-04-29
Bife de Atum,1.0,2026-04-29
Bolinhas Alheira (6 Un.),1.0,2026-04-29
Café,20.0,2026-04-29
Caldo Verde,2.0,2026-04-29
Cesto de Pão,1.0,2026-04-29
Chá,1.0,2026-04-29
Coca-Cola,2.0,2026-04-29
Couvert,7.0,2026-04-29
Doce da casa,7.0,2026-04-29
Dourada/Robalo Grelhado,1.0,2026-04-29
Entrecôte,1.0,2026-04-29
Filetes Peixe Galo,7.5,2026-04-29
Filetes de Polvo,0.5,2026-04-29
Fruta Tropical,2.0,2026-04-29
Ice Tea,2.0,2026-04-29
Menu Dia,29.0,2026-04-29
Mouse,2.0,2026-04-29
Ovos Rotos,1.0,2026-04-29
Pica-pau,1.0,2026-04-29
Porto Ferreira Tawny,1.0,2026-04-29
Prato do dia Carne,12.0,2026-04-29
Prato do dia Peixe,18.0,2026-04-29
Pudim,2.0,2026-04-29
Queijo Couvert,1.0,2026-04-29
Sopa,2.0,2026-04-29
TT Vinha Grande,1.0,2026-04-29
Take Away,4.0,2026-04-29
Vinho 0.5L,2.0,2026-04-29
Vinho 1L,1.0,2026-04-29
Água 0.5L,4.0,2026-04-29
Água c/gás,1.0,2026-04-29
Alheira,1.0,2026-04-30
Arroz de Rabo de Boi,2.0,2026-04-30
BR Planalto,1.0,2026-04-30
BR Volupia,1.0,2026-04-30
Bacalhau à Brás,1.0,2026-04-30
Bacalhau à Lagareiro,2.0,2026-04-30
Bebida Dia,28.0,2026-04-30
Bife de Atum,3.0,2026-04-30
Black Label,3.0,2026-04-30
Café,15.0,2026-04-30
Camarão da Costa,1.0,2026-04-30
Carne de Porco à Alentejana,2.0,2026-04-30
Cesto de Pão,1.0,2026-04-30
Coca-Cola,3.0,2026-04-30
Couvert,9.0,2026-04-30
Coxa de Pato Confitada,1.0,2026-04-30
Doce da casa,3.0,2026-04-30
Dourada/Robalo Grelhado,1.0,2026-04-30
Entrecôte,2.0,2026-04-30
Filetes Peixe Galo,5.5,2026-04-30
Fino,5.0,2026-04-30
Fruta Tropical,1.0,2026-04-30
Magret de Pato,1.0,2026-04-30
Maça Assada,1.0,2026-04-30
Menu Dia,24.97,2026-04-30
"Menu Dia,Prato do dia Carne,Bebida Dia",3.03,2026-04-30
Mini Sagres,2.0,2026-04-30
Mouse,2.0,2026-04-30
Ovos Rotos,1.0,2026-04-30
Pera Bêbada,1.0,2026-04-30
Pica-Pau Terra e Mar,1.0,2026-04-30
Picanha,2.0,2026-04-30
Prato do dia Carne,28.0,2026-04-30
Pudim,4.0,2026-04-30
Queijo Couvert,1.0,2026-04-30
Sopa de Marisco,1.0,2026-04-30
TT Vinha Grande,1.0,2026-04-30
Take Away,5.0,2026-04-30
Tostas de Rabo de Boi,1.0,2026-04-30
V Muralhas,2.0,2026-04-30
Vinho 0.5L,6.0,2026-04-30
Vinho 1L,1.0,2026-04-30
Vinho Tinto da casa (copo),2.0,2026-04-30
Água 0.5L,4.0,2026-04-30
Água c/gás,4.0,2026-04-30
Ameijoas à Bulhão Pato,2.0,2026-05-01
Arroz de Rabo de Boi,1.0,2026-05-01
BR GALHARDINI,1.0,2026-05-01
BR Papa Figos,1.0,2026-05-01
BR Piano Moscatel Galego,1.0,2026-05-01
Bacalhau à Lagareiro,1.0,2026-05-01
Bacalhau à Narcisa,2.0,2026-05-01
Batata dose,1.0,2026-05-01
Bebida Dia,2.0,2026-05-01
Beirão,1.0,2026-05-01
Bife Lombo,2.0,2026-05-01
Café,19.0,2026-05-01
Carne de Porco à Alentejana,1.0,2026-05-01
Cesto de Pão,1.0,2026-05-01
Coca-Cola,3.0,2026-05-01
Couvert,11.0,2026-05-01
Cozido à Portuguesa,3.0,2026-05-01
Doce da casa,2.0,2026-05-01
Entrecôte,1.0,2026-05-01
Filetes Peixe Galo,5.5,2026-05-01
Filetes de Polvo,3.5,2026-05-01
Fino,9.0,2026-05-01
Ice Tea,1.0,2026-05-01
Legumes Salteados,2.0,2026-05-01
Manteiga,2.0,2026-05-01
Menu Dia,1.0,2026-05-01
Mini Sagres,10.0,2026-05-01
Mouse,2.0,2026-05-01
Omelete Camarão,1.0,2026-05-01
Picanha,4.0,2026-05-01
Polvo à Lagareiro,5.0,2026-05-01
Posta,1.0,2026-05-01
Prato do dia Carne,2.0,2026-05-01
Pudim,3.0,2026-05-01
Salada,3.0,2026-05-01
Sangria 1.5L,1.0,2026-05-01
Sopa,3.0,2026-05-01
Sopa de Peixe,3.0,2026-05-01
TT Dona Matilde,2.0,2026-05-01
TT Monte Peceguinha,2.0,2026-05-01
TT Papa Figos,1.0,2026-05-01
TT V.Nídeo Reserva,1.0,2026-05-01
Take Away,1.0,2026-05-01
Tostas de Rabo de Boi,3.0,2026-05-01
Vinho 0.5L,2.0,2026-05-01
Vinho do Porto (dose),1.0,2026-05-01
Água 0.5L,8.0,2026-05-01
Alheira,1.0,2026-05-02
Arroz de Polvo,3.0,2026-05-02
Arroz de Rabo de Boi,2.0,2026-05-02
BR Valle do Nídeo,2.0,2026-05-02
BR Vinha Grande,2.0,2026-05-02
Bacalhau à Narcisa,3.0,2026-05-02
Bebida Dia,4.0,2026-05-02
Bife de Atum,3.0,2026-05-02
Black Label,3.0,2026-05-02
Bolinhas Alheira (6 Un.),3.0,2026-05-02
Café,26.0,2026-05-02
Caldo Verde,1.0,2026-05-02
Camarao ao alho,3.0,2026-05-02
Camarão costa (Peq.),1.0,2026-05-02
Cesto de Pão,3.0,2026-05-02
Coca-Cola,2.0,2026-05-02
Couvert,11.0,2026-05-02
Coxa de Pato Confitada,1.0,2026-05-02
Cozido à Portuguesa,8.0,2026-05-02
Doce da casa,5.0,2026-05-02
Entrecôte,1.0,2026-05-02
Filetes Peixe Galo,11.0,2026-05-02
Filetes de Polvo,7.0,2026-05-02
Fino,20.0,2026-05-02
Magret de Pato,2.0,2026-05-02
Maça Assada,4.0,2026-05-02
Menu Dia,2.0,2026-05-02
Mouse,7.0,2026-05-02
Ovos Rotos,1.0,2026-05-02
Pera Bêbada,6.0,2026-05-02
Pica-pau,1.0,2026-05-02
Picanha,2.0,2026-05-02
Polvo Ensalsado,1.0,2026-05-02
Polvo à Lagareiro,1.0,2026-05-02
Prato do dia Carne,4.0,2026-05-02
Prego,1.0,2026-05-02
Pudim,2.0,2026-05-02
Sangria Espumante 1.5L,3.0,2026-05-02
Sopa de Marisco,2.0,2026-05-02
Sopa de Peixe,2.0,2026-05-02
TT Duvalley Reserva,1.0,2026-05-02
TT Papa Figos,2.0,2026-05-02
Take Away,6.0,2026-05-02
Taça de Gelado,4.0,2026-05-02
Tostas de Rabo de Boi,3.0,2026-05-02
V Regueiro,1.0,2026-05-02
Vinho 0.5L,9.0,2026-05-02
Vinho Branco da casa (copo),2.0,2026-05-02
Água 0.5L,18.0,2026-05-02
Água c/gás,3.0,2026-05-02
Ameijoas à Bulhão Pato,2.0,2026-05-04
Arroz de Marisco 2Pax,1.0,2026-05-04
BR Volupia,1.0,2026-05-04
Bacalhau à Brás,2.0,2026-05-04
Bacalhau à Lagareiro,1.0,2026-05-04
Batata dose,2.0,2026-05-04
Bebida Dia,16.0,2026-05-04
Bife Lombo,1.0,2026-05-04
Bolinhas Alheira (6 Un.),2.0,2026-05-04
Café,22.0,2026-05-04
Caldo Verde,1.0,2026-05-04
Camarao ao alho,1.0,2026-05-04
Camarão costa (Peq.),1.0,2026-05-04
Camarão da Costa,1.0,2026-05-04
Carne de Porco à Alentejana,1.0,2026-05-04
Cesto de Pão,2.0,2026-05-04
Coca-Cola,3.0,2026-05-04
Couvert,6.0,2026-05-04
Doce da casa,2.0,2026-05-04
Filetes Peixe Galo,6.5,2026-05-04
Filetes de Polvo,5.0,2026-05-04
Fino,4.0,2026-05-04
Manteiga,1.0,2026-05-04
Melão com Presunto,1.0,2026-05-04
Menu Dia,9.0,2026-05-04
Mouse,1.0,2026-05-04
Pera Bêbada,1.0,2026-05-04
Prato do dia Carne,2.0,2026-05-04
Prato do dia Peixe,16.0,2026-05-04
Salada,1.0,2026-05-04
Seven Up,3.0,2026-05-04
Sopa,1.0,2026-05-04
TT Ribeiro Santo Res,2.0,2026-05-04
Tostas de Rabo de Boi,1.0,2026-05-04
Vinho 0.5L,2.0,2026-05-04
Vinho 1L,1.0,2026-05-04
Vinho Branco da casa (copo),2.0,2026-05-04
Água Menu,2.0,2026-05-04
Ameijoas à Bulhão Pato,1.0,2026-05-05
Arroz de Rabo de Boi,1.0,2026-05-05
Arroz de Tamboril,2.0,2026-05-05
Azeitonas,1.0,2026-05-05
BR GALHARDINI,1.0,2026-05-05
Bacalhau à Lagareiro,2.0,2026-05-05
Bebida Dia,14.0,2026-05-05
Bife de Atum,1.0,2026-05-05
Café,16.0,2026-05-05
Carne de Porco à Alentejana,3.0,2026-05-05
Cesto de Pão,1.0,2026-05-05
Coca-Cola,3.0,2026-05-05
Couvert,8.0,2026-05-05
Doce da casa,3.0,2026-05-05
ES Ortigão Nektar,2.0,2026-05-05
Filetes Peixe Galo,13.5,2026-05-05
Filetes de Polvo,5.5,2026-05-05
Fino,4.0,2026-05-05
Fruta Tropical,3.0,2026-05-05
Magret de Pato,1.0,2026-05-05
Menu 25€,6.0,2026-05-05
Menu Degustação Simples,12.0,2026-05-05
Menu Dia,8.0,2026-05-05
Mouse,1.0,2026-05-05
Ovos Rotos,1.0,2026-05-05
Picanha,3.0,2026-05-05
Polvo Ensalsado,1.0,2026-05-05
Polvo à Lagareiro,1.0,2026-05-05
Posta,1.0,2026-05-05
Prato do dia Carne,4.0,2026-05-05
Prato do dia Peixe,12.0,2026-05-05
Pudim,1.0,2026-05-05
Queijo Couvert,3.0,2026-05-05
Salada,1.0,2026-05-05
TT Duvalley,1.0,2026-05-05
TT Galhardini,2.0,2026-05-05
TT Monte Peceguinha,2.0,2026-05-05
TT Ribeiro Santo colheita,1.0,2026-05-05
Take Away,4.0,2026-05-05
Tostas de Rabo de Boi,2.0,2026-05-05
Vinho 0.5L,1.0,2026-05-05
Vinho Branco da casa (copo),1.0,2026-05-05
Vinho Menu,18.0,2026-05-05
Água 0.5L,5.0,2026-05-05
Água Menu,2.0,2026-05-05
Água c/gás,2.0,2026-05-05
Bacalhau à Brás,1.0,2026-05-06
Bebida Dia,8.0,2026-05-06
Bolinhas Alheira (6 Un.),1.0,2026-05-06
Café,6.0,2026-05-06
Caldo Verde,1.0,2026-05-06
Carne de Porco à Alentejana,2.0,2026-05-06
Coca-Cola,2.0,2026-05-06
Couvert,3.0,2026-05-06
Delicia de Chocolate,1.0,2026-05-06
Entrecôte,1.0,2026-05-06
Filetes Peixe Galo,1.0,2026-05-06
Fino,8.0,2026-05-06
Ice Tea,2.0,2026-05-06
Maça Assada,2.0,2026-05-06
Menu Dia,5.0,2026-05-06
Pera Bêbada,1.0,2026-05-06
Picanha,1.0,2026-05-06
Prato do dia Carne,8.0,2026-05-06
Prato do dia Peixe,2.0,2026-05-06
Queijo Couvert,1.0,2026-05-06
Take Away,1.0,2026-05-06
Taça de Gelado,2.0,2026-05-06
Vinho 0.5L,1.0,2026-05-06
Vinho 1L,1.0,2026-05-06
Água 0.5L,1.0,2026-05-06
Água Menu,2.0,2026-05-06
Arroz Doce,1.0,2026-05-07
BR Dona Matilde,1.0,2026-05-07
BR Luis Pato Maria Gomes,1.0,2026-05-07
Batata dose,1.0,2026-05-07
Bebida Dia,2.0,2026-05-07
Bife Lombo,1.0,2026-05-07
Bife de Atum,2.0,2026-05-07
Café,5.0,2026-05-07
Coca-Cola,1.0,2026-05-07
Couvert,5.0,2026-05-07
Doce da casa,1.0,2026-05-07
Entrecôte,2.0,2026-05-07
Filetes Peixe Galo,6.0,2026-05-07
Fino,17.0,2026-05-07
Ice Tea,2.0,2026-05-07
Magret de Pato,1.0,2026-05-07
Menu Dia,1.0,2026-05-07
Mouse,2.0,2026-05-07
Picanha,1.0,2026-05-07
Polvo à Lagareiro,1.0,2026-05-07
Prato do dia Peixe,2.0,2026-05-07
Pudim,1.0,2026-05-07
Taça de Gelado,2.0,2026-05-07
Vinho 0.5L,1.0,2026-05-07
Água 0.5L,2.0,2026-05-07
Água c/gás,1.0,2026-05-07
Ameijoas à Bulhão Pato,1.0,2026-05-08
Arroz Doce,3.0,2026-05-08
Arroz de Polvo,1.0,2026-05-08
BR Burmester meia gr.,1.0,2026-05-08
Bacalhau à Brás,1.0,2026-05-08
Bebida Dia,16.0,2026-05-08
Café,18.0,2026-05-08
Chá,2.0,2026-05-08
Couvert,6.0,2026-05-08
Delicia de Chocolate,1.0,2026-05-08
Doce da casa,4.0,2026-05-08
ES Quinta Monteirinhos,2.0,2026-05-08
Entrecôte,1.0,2026-05-08
Filetes Peixe Galo,2.0,2026-05-08
Fino,2.0,2026-05-08
Fruta Tropical,2.0,2026-05-08
Ice Tea,1.0,2026-05-08
Magret de Pato,1.0,2026-05-08
Menu Dia,18.82,2026-05-08
"Menu Dia,Prato do dia Carne,Bebida Dia",1.91,2026-05-08
Mini Sagres,12.0,2026-05-08
Mouse,1.0,2026-05-08
Pera Bêbada,2.0,2026-05-08
Pica-pau,1.0,2026-05-08
Polvo Ensalsado,1.0,2026-05-08
Prato do dia Carne,16.0,2026-05-08
Prato do dia Peixe,6.0,2026-05-08
Pudim,2.0,2026-05-08
Sopa,1.0,2026-05-08
Sopa de Peixe,2.0,2026-05-08
TT Galhardini,1.0,2026-05-08
TT Ribeiro Santo Res,1.0,2026-05-08
Take Away,1.0,2026-05-08
Vinho 0.5L,4.0,2026-05-08
Vinho Menu,1.0,2026-05-08
Água 0.5L,1.0,2026-05-08
Água Menu,6.0,2026-05-08
Água c/gás,1.0,2026-05-08
BR GALHARDINI,1.0,2026-05-09
BR Piano Moscatel Galego,1.0,2026-05-09
Bacalhau à Lagareiro,1.0,2026-05-09
Bacalhau à Narcisa,2.0,2026-05-09
Beirão,1.0,2026-05-09
Bife Lombo,1.0,2026-05-09
Bife de Atum,3.0,2026-05-09
Bolinhas Alheira (6 Un.),1.0,2026-05-09
Café,14.0,2026-05-09
Carne de Porco à Alentejana,2.0,2026-05-09
Cesto de Pão,2.0,2026-05-09
Coca-Cola,3.0,2026-05-09
Compal Néctar,1.0,2026-05-09
Couvert,10.0,2026-05-09
Cozido à Portuguesa,6.0,2026-05-09
Doce da casa,6.0,2026-05-09
Entrecôte,3.0,2026-05-09
Filetes Peixe Galo,9.5,2026-05-09
Filetes de Polvo,5.5,2026-05-09
Fino,7.0,2026-05-09
Ice Tea,1.0,2026-05-09
Magret de Pato,2.0,2026-05-09
Melão com Presunto,1.0,2026-05-09
Mini Sagres,9.0,2026-05-09
Mouse,2.0,2026-05-09
Ovos Rotos,1.0,2026-05-09
Pera Bêbada,2.0,2026-05-09
Picanha,2.0,2026-05-09
Queijo Couvert,1.0,2026-05-09
Salada,1.0,2026-05-09
Sopa,2.0,2026-05-09
Sopa de Peixe,1.0,2026-05-09
Take Away,3.0,2026-05-09
Taça de Gelado,2.0,2026-05-09
Vinho 0.5L,3.0,2026-05-09
Vinho 1L,1.0,2026-05-09
Vinho Menu,1.0,2026-05-09
Vinho Tinto da casa (copo),1.0,2026-05-09
Água 0.5L,11.0,2026-05-09
Água c/gás,2.0,2026-05-09
Arroz de Rabo de Boi,1.0,2026-05-11
BR Luis Pato Vinhas Velhas,1.0,2026-05-11
BR Ribeiro Santo Encruzado,1.0,2026-05-11
Batata dose,1.0,2026-05-11
Bebida Dia,16.0,2026-05-11
Bife de Atum,3.0,2026-05-11
Bolinhas de Alheira (3 Un.),1.0,2026-05-11
CRF-Reserva,2.0,2026-05-11
Café,24.0,2026-05-11
Camarao ao alho,1.0,2026-05-11
Carne de Porco à Alentejana,1.0,2026-05-11
Cerveja S/Alcool,1.0,2026-05-11
Couvert,11.0,2026-05-11
Doce da casa,2.0,2026-05-11
Filetes Peixe Galo,3.5,2026-05-11
Filetes de Polvo,2.5,2026-05-11
Fino,3.0,2026-05-11
Jameson,1.0,2026-05-11
Magret de Pato,1.0,2026-05-11
Menu Dia,20.0,2026-05-11
Mini Sagres,1.0,2026-05-11
Mouse,3.0,2026-05-11
Pera Bêbada,2.0,2026-05-11
Prato do dia Carne,12.0,2026-05-11
Prato do dia Peixe,28.0,2026-05-11
Sangria 1.5L,1.0,2026-05-11
Sopa de Marisco,4.0,2026-05-11
Sopa de Peixe,2.0,2026-05-11
TT Ribeiro Santo Res,1.0,2026-05-11
Take Away,3.0,2026-05-11
Tostas de Rabo de Boi,4.0,2026-05-11
Água 0.5L,3.0,2026-05-11
Água Menu,24.0,2026-05-11
Água c/gás,2.0,2026-05-11
Ameijoas à Bulhão Pato,1.0,2026-05-12
BR GALHARDINI,1.0,2026-05-12
BR Monte Peceguinha,2.0,2026-05-12
BR Papa Figos,1.0,2026-05-12
BR Ribeiro Santo Encruzado,5.0,2026-05-12
Bacalhau à Brás,1.0,2026-05-12
Bebida Dia,22.0,2026-05-12
Café,23.0,2026-05-12
Couvert,7.0,2026-05-12
Doce da casa,2.0,2026-05-12
Dourada/Robalo Grelhado,1.0,2026-05-12
Entrecôte,1.0,2026-05-12
Filetes Peixe Galo,7.0,2026-05-12
Filetes de Polvo,3.0,2026-05-12
Fino,11.0,2026-05-12
Menu 25€,3.0,2026-05-12
Menu Degustação Simples,6.0,2026-05-12
Menu Dia,18.0,2026-05-12
Omelete Camarão,1.0,2026-05-12
Polvo à Lagareiro,1.0,2026-05-12
Prato do dia Carne,16.0,2026-05-12
Prato do dia Peixe,20.0,2026-05-12
Queijo Couvert,1.0,2026-05-12
Salada,1.0,2026-05-12
Sopa,1.0,2026-05-12
Sopa de Peixe,1.0,2026-05-12
Take Away,1.0,2026-05-12
V Muralhas,1.0,2026-05-12
Vinho Menu,8.0,2026-05-12
Água 0.5L,2.0,2026-05-12
Água Menu,14.0,2026-05-12
BR Luis Pato Vinhas Velhas,1.0,2026-05-13
BR Papa Figos,2.0,2026-05-13
BR Ribeiro Santo Encruzado,2.0,2026-05-13
Bacalhau à Brás,3.0,2026-05-13
Bebida Dia,18.0,2026-05-13
Bolinhas de Alheira (3 Un.),1.0,2026-05-13
Café,70.0,2026-05-13
Camarao ao alho,5.0,2026-05-13
Camarão costa (Peq.),2.0,2026-05-13
Camarão da Costa,1.0,2026-05-13
Cesto de Pão,2.0,2026-05-13
Chá,1.0,2026-05-13
Coca-Cola,4.0,2026-05-13
Couvert,10.0,2026-05-13
Doce da casa,7.0,2026-05-13
Entrecôte,2.0,2026-05-13
Filetes Peixe Galo,4.0,2026-05-13
Filetes de Polvo,1.0,2026-05-13
Fino,7.0,2026-05-13
Legumes Salteados,2.0,2026-05-13
Maça Assada,2.0,2026-05-13
Menu 35€,57.0,2026-05-13
Menu Dia,24.29,2026-05-13
"Menu Dia,Prato do dia Carne,Bebida Dia",1.71,2026-05-13
Mini Sagres,3.0,2026-05-13
Mouse,1.0,2026-05-13
Ovos Rotos,2.0,2026-05-13
Pera Bêbada,2.0,2026-05-13
Polvo Ensalsado,1.0,2026-05-13
Polvo à Lagareiro,6.0,2026-05-13
Prato do dia Carne,12.0,2026-05-13
Prato do dia Peixe,14.0,2026-05-13
Prego,2.0,2026-05-13
Queijo Couvert,2.0,2026-05-13
Seven Up,1.0,2026-05-13
Sopa,1.0,2026-05-13
Sopa de Peixe,3.0,2026-05-13
Take Away,3.0,2026-05-13
Tostas de Rabo de Boi,3.0,2026-05-13
V Muralhas,1.0,2026-05-13
Vinho 0.5L,7.0,2026-05-13
Vinho 1L,3.0,2026-05-13
Vinho Tinto da casa (copo),2.0,2026-05-13
Água 0.5L,8.0,2026-05-13
Água Menu,46.0,2026-05-13
Água c/gás,3.0,2026-05-13
Ameijoas à Bulhão Pato,1.0,2026-05-14
Arroz de Polvo,2.0,2026-05-14
Arroz de Tamboril,2.0,2026-05-14
BR GALHARDINI,1.0,2026-05-14
Bacalhau à Brás,2.0,2026-05-14
Bacalhau à Lagareiro,5.0,2026-05-14
Bebida Dia,20.0,2026-05-14
Bife de Atum,3.0,2026-05-14
Bolinhas de Alheira (3 Un.),1.0,2026-05-14
Brandy Croft,2.0,2026-05-14
Café,20.0,2026-05-14
Camarão da Costa,1.0,2026-05-14
Carne de Porco à Alentejana,3.0,2026-05-14
Cerveja S/Alcool,3.0,2026-05-14
Cesto de Pão,3.0,2026-05-14
Chá,2.0,2026-05-14
Coca-Cola,13.0,2026-05-14
Compal Néctar,1.0,2026-05-14
Couvert,14.0,2026-05-14
Coxa de Pato Confitada,1.0,2026-05-14
Doce da casa,1.0,2026-05-14
Filetes Peixe Galo,3.0,2026-05-14
Filetes de Polvo,5.5,2026-05-14
Fino,26.0,2026-05-14
Ice Tea,1.0,2026-05-14
Legumes Salteados,1.0,2026-05-14
Martel,1.0,2026-05-14
Maça Assada,1.0,2026-05-14
Menu Dia,10.0,2026-05-14
Picanha,4.0,2026-05-14
Polvo à Lagareiro,2.0,2026-05-14
Prato do dia Carne,12.0,2026-05-14
Prato do dia Peixe,8.0,2026-05-14
Salada,1.0,2026-05-14
Sopa,2.0,2026-05-14
Sopa de Marisco,1.0,2026-05-14
TT V.Nídeo Reserva,1.0,2026-05-14
Take Away,2.0,2026-05-14
Taça de Gelado,2.0,2026-05-14
V Muralhas,1.0,2026-05-14
Vinho 0.5L,3.0,2026-05-14
Vinho Menu,1.0,2026-05-14
Água 0.5L,6.0,2026-05-14
Água c/gás,3.0,2026-05-14
Arroz de Tamboril,1.0,2026-05-15
Azeitonas,1.0,2026-05-15
BR Monte Peceguinha,2.0,2026-05-15
BR Papa Figos,1.0,2026-05-15
BR V. Nídeo SauvignonBlanc,1.0,2026-05-15
Bacalhau à Brás,1.0,2026-05-15
Bacalhau à Lagareiro,1.0,2026-05-15
Bebida Dia,12.0,2026-05-15
Bife Lombo,1.0,2026-05-15
Bolinhas Alheira (6 Un.),1.0,2026-05-15
Café,37.0,2026-05-15
Carne de Porco à Alentejana,5.0,2026-05-15
Cesto de Pão,2.0,2026-05-15
Chouriço Assado,2.0,2026-05-15
Coca-Cola,5.0,2026-05-15
Couvert,17.0,2026-05-15
Doce da casa,4.0,2026-05-15
Dourada/Robalo Grelhado,1.0,2026-05-15
ES Quinta Monteirinhos,1.0,2026-05-15
Filetes Peixe Galo,35.0,2026-05-15
Filetes de Polvo,10.0,2026-05-15
Fino,7.0,2026-05-15
Fruta Tropical,1.0,2026-05-15
Ice Tea,1.0,2026-05-15
Legumes Salteados,1.0,2026-05-15
Maça Assada,1.0,2026-05-15
Menu Dia,11.0,2026-05-15
Mini Sagres,3.0,2026-05-15
Mouse,7.0,2026-05-15
Pica-Pau Terra e Mar,1.0,2026-05-15
Pica-pau,1.0,2026-05-15
Picanha,1.0,2026-05-15
Prato do dia Carne,4.0,2026-05-15
Prato do dia Peixe,18.0,2026-05-15
Pudim,4.0,2026-05-15
RS Papa Figos,2.0,2026-05-15
RS Titular Rosé,1.0,2026-05-15
Salada,1.0,2026-05-15
Sangria Espumante 1.5L,1.0,2026-05-15
Sopa de Marisco,1.0,2026-05-15
Sopa de Peixe,2.0,2026-05-15
Take Away,2.0,2026-05-15
V Regueiro,2.0,2026-05-15
Vinho 0.5L,4.0,2026-05-15
Vinho 1L,1.0,2026-05-15
Vinho Menu,1.0,2026-05-15
Vinho Tinto da casa (copo),1.0,2026-05-15
Água 0.5L,4.0,2026-05-15
Água Menu,10.0,2026-05-15
Água c/gás,5.0,2026-05-15
BR Monte Peceguinha,1.0,2026-05-16
BR Ribeiro Santo Encruzado,7.0,2026-05-16
Bacalhau à Brás,2.0,2026-05-16
Bacalhau à Narcisa,3.0,2026-05-16
Bife de Atum,2.0,2026-05-16
Bolinhas Alheira (6 Un.),4.0,2026-05-16
Café,9.0,2026-05-16
Camarao ao alho,4.0,2026-05-16
Carne de Porco à Alentejana,4.0,2026-05-16
Chouriço Assado,3.0,2026-05-16
Coca-Cola,4.0,2026-05-16
Compal Néctar,1.0,2026-05-16
Couvert,13.0,2026-05-16
Coxa de Pato Confitada,2.0,2026-05-16
Cozido à Portuguesa,5.0,2026-05-16
Doce da casa,5.0,2026-05-16
Dourada/Robalo Grelhado,1.0,2026-05-16
ES S. Domingos Extra Reserva,1.0,2026-05-16
Filetes Peixe Galo,17.0,2026-05-16
Fino,13.0,2026-05-16
Ice Tea,2.0,2026-05-16
Maça Assada,5.0,2026-05-16
Mini Sagres,5.0,2026-05-16
Mouse,1.0,2026-05-16
Omelete Camarão,2.0,2026-05-16
Ovos Rotos,3.0,2026-05-16
Pera Bêbada,3.0,2026-05-16
Picanha,1.0,2026-05-16
Pudim,2.0,2026-05-16
Sangria Espumante 1.5L,1.0,2026-05-16
Sopa,1.0,2026-05-16
Sopa de Peixe,3.0,2026-05-16
Take Away,3.0,2026-05-16
Vinho 0.5L,2.0,2026-05-16
Vinho Tinto da casa (copo),2.0,2026-05-16
Água 0.5L,15.0,2026-05-16
Água c/gás,4.0,2026-05-16
Ameijoas à Bulhão Pato,1.0,2026-05-18
Arroz de Polvo,1.0,2026-05-18
BR Dona Matilde,1.0,2026-05-18
BR Luis Pato Vinhas Velhas,1.0,2026-05-18
BR Monte Peceguinha,1.0,2026-05-18
Bacalhau à Brás,2.0,2026-05-18
Bacalhau à Lagareiro,1.0,2026-05-18
Bebida Dia,18.0,2026-05-18
Bife de Atum,1.0,2026-05-18
Bolinhas de Alheira (3 Un.),1.0,2026-05-18
Café,13.0,2026-05-18
Cesto de Pão,1.0,2026-05-18
Chá,1.0,2026-05-18
Coca-Cola,1.0,2026-05-18
Couvert,11.0,2026-05-18
Doce da casa,2.0,2026-05-18
Dourada/Robalo Grelhado,1.0,2026-05-18
Filetes Peixe Galo,8.5,2026-05-18
Filetes de Polvo,2.5,2026-05-18
Fino,5.0,2026-05-18
Fruta Tropical,2.0,2026-05-18
Ice Tea,1.0,2026-05-18
Menu Dia,12.0,2026-05-18
Pera Bêbada,1.0,2026-05-18
Pica-pau,1.0,2026-05-18
Picanha,1.0,2026-05-18
Prato do dia Carne,4.0,2026-05-18
Prato do dia Peixe,20.0,2026-05-18
Sangria 1.5L,1.0,2026-05-18
Sangria Espumante 1.5L,1.0,2026-05-18
Sopa,3.0,2026-05-18
Sopa de Peixe,3.0,2026-05-18
TT Ribeiro Santo Res,1.0,2026-05-18
Take Away,3.0,2026-05-18
Taça de Gelado,2.0,2026-05-18
Tostas de Rabo de Boi,5.0,2026-05-18
Vinho 0.5L,1.0,2026-05-18
Vinho Menu,1.0,2026-05-18
Vinho do Porto (dose),1.0,2026-05-18
Água 0.5L,2.0,2026-05-18
Água Menu,6.0,2026-05-18
Água c/gás,4.0,2026-05-18
Ameijoas à Bulhão Pato,1.0,2026-05-19
Arroz de Rabo de Boi,1.0,2026-05-19
Bacalhau à Brás,1.0,2026-05-19
Bebida Dia,8.0,2026-05-19
Bife de Atum,2.0,2026-05-19
Bolinhas Alheira (6 Un.),1.0,2026-05-19
Café,11.0,2026-05-19
Caldo Verde,1.0,2026-05-19
Camarao ao alho,1.0,2026-05-19
Coca-Cola,1.0,2026-05-19
Couvert,5.0,2026-05-19
Entrecôte,1.0,2026-05-19
Fruta Tropical,2.0,2026-05-19
Ice Tea,2.0,2026-05-19
Menu 25€,8.0,2026-05-19
Menu Degustação Simples,16.0,2026-05-19
Menu Dia,6.0,2026-05-19
Mouse,1.0,2026-05-19
Ovos Rotos,1.0,2026-05-19
Polvo à Lagareiro,1.0,2026-05-19
Prato do dia Carne,8.0,2026-05-19
Prato do dia Peixe,4.0,2026-05-19
Pudim,1.0,2026-05-19
Sopa de Peixe,4.0,2026-05-19
TT Duvalley Reserva,2.0,2026-05-19
TT Vinha Grande,1.0,2026-05-19
Take Away,1.0,2026-05-19
Tostas de Rabo de Boi,1.0,2026-05-19
Vinho 0.5L,1.0,2026-05-19
Vinho Menu,16.0,2026-05-19
Água 0.5L,1.0,2026-05-19
Água Menu,4.0,2026-05-19
Ameijoas à Bulhão Pato,1.0,2026-05-20
Azeitonas,1.0,2026-05-20
BR A.Mayor Comendador,1.0,2026-05-20
BR Papa Figos,2.0,2026-05-20
BR Volupia,1.0,2026-05-20
Bacalhau à Brás,1.0,2026-05-20
Batata dose,2.0,2026-05-20
Bebida Dia,4.0,2026-05-20
Bife Lombo,2.0,2026-05-20
Café,19.0,2026-05-20
Camarão costa (Peq.),2.0,2026-05-20
Carne de Porco à Alentejana,2.0,2026-05-20
Cesto de Pão,1.0,2026-05-20
Coca-Cola,1.0,2026-05-20
Couvert,9.0,2026-05-20
Delicia de Chocolate,5.0,2026-05-20
Doce da casa,8.0,2026-05-20
Dourada/Robalo Grelhado,3.0,2026-05-20
Entrecôte,2.0,2026-05-20
Filetes Peixe Galo,7.0,2026-05-20
Filetes de Polvo,5.0,2026-05-20
Fino,8.0,2026-05-20
Fruta,2.0,2026-05-20
Fruta Tropical,2.0,2026-05-20
Ice Tea,6.0,2026-05-20
Legumes Salteados,2.0,2026-05-20
Magret de Pato,1.0,2026-05-20
Manteiga,1.0,2026-05-20
Menu Dia,4.0,2026-05-20
Mouse,2.0,2026-05-20
Ovos Rotos,3.0,2026-05-20
Pera Bêbada,2.0,2026-05-20
Picanha,2.0,2026-05-20
Prato do dia Carne,4.0,2026-05-20
Prato do dia Peixe,4.0,2026-05-20
Pudim,2.0,2026-05-20
Queijo Couvert,2.0,2026-05-20
Sangria Espumante 1.5L,2.0,2026-05-20
Seven Up,1.0,2026-05-20
Sopa,2.0,2026-05-20
Sopa de Peixe,2.0,2026-05-20
Take Away,3.0,2026-05-20
Tostas de Rabo de Boi,3.0,2026-05-20
Vinho 0.5L,4.0,2026-05-20
Vinho 1L,1.0,2026-05-20
Vinho Branco da casa (copo),3.0,2026-05-20
Vinho Menu,1.0,2026-05-20
Vinho Tinto da casa (copo),1.0,2026-05-20
Água 0.5L,7.0,2026-05-20
Água Menu,4.0,2026-05-20
Água c/gás,3.0,2026-05-20
Arroz de Tamboril,3.0,2026-05-21
Bacalhau à Lagareiro,2.0,2026-05-21
Bebida Dia,16.0,2026-05-21
Café,17.0,2026-05-21
Camarão costa (Peq.),2.0,2026-05-21
Cesto de Pão,1.0,2026-05-21
Coca-Cola,3.0,2026-05-21
Couvert,6.0,2026-05-21
Delicia de Chocolate,2.0,2026-05-21
Doce da casa,1.0,2026-05-21
Filetes Peixe Galo,4.0,2026-05-21
Filetes de Polvo,1.0,2026-05-21
Fino,13.0,2026-05-21
Fruta Tropical,1.0,2026-05-21
Manteiga,1.0,2026-05-21
Menu Dia,10.0,2026-05-21
Mini Sagres,5.0,2026-05-21
Mouse,2.0,2026-05-21
Pera Bêbada,1.0,2026-05-21
Picanha,1.0,2026-05-21
Prato do dia Carne,16.0,2026-05-21
Prato do dia Peixe,4.0,2026-05-21
Sopa de Peixe,5.0,2026-05-21
Tostas de Rabo de Boi,2.0,2026-05-21
Vinho 0.5L,1.0,2026-05-21
Vinho Branco da casa (copo),1.0,2026-05-21
Água 0.5L,2.0,2026-05-21
Água Menu,4.0,2026-05-21
Alheira,1.0,2026-05-22
Arroz de Rabo de Boi,1.0,2026-05-22
Arroz de Tamboril,1.0,2026-05-22
Azeitonas,1.0,2026-05-22
BR Luis Pato Vinhas Velhas,1.0,2026-05-22
BR Titular Colheita,1.0,2026-05-22
BR Volupia,1.0,2026-05-22
Bebida Dia,12.0,2026-05-22
CRF-Reserva,3.0,2026-05-22
Café,12.0,2026-05-22
Cerveja S/Alcool,1.0,2026-05-22
Coca-Cola,4.0,2026-05-22
Couvert,9.0,2026-05-22
Doce da casa,1.0,2026-05-22
Filetes Peixe Galo,9.0,2026-05-22
Filetes de Polvo,1.0,2026-05-22
Fino,1.0,2026-05-22
Fruta Tropical,1.0,2026-05-22
Ice Tea,2.0,2026-05-22
Menu Dia,12.0,2026-05-22
Mini Sagres,3.0,2026-05-22
Pera Bêbada,4.0,2026-05-22
Polvo à Lagareiro,1.0,2026-05-22
Prato do dia Carne,8.0,2026-05-22
Prato do dia Peixe,16.0,2026-05-22
Pudim,2.0,2026-05-22
Salada,1.0,2026-05-22
Sopa,2.0,2026-05-22
Sopa de Peixe,1.0,2026-05-22
TT Dona Matilde Res,1.0,2026-05-22
Take Away,2.0,2026-05-22
Tostas de Rabo de Boi,3.0,2026-05-22
Vinho 0.5L,1.0,2026-05-22
Vinho Branco da casa (copo),1.0,2026-05-22
Vinho Tinto da casa (copo),1.0,2026-05-22
Água Menu,12.0,2026-05-22
Água c/gás,3.0,2026-05-22
Ameijoas à Bulhão Pato,1.0,2026-06-03
Arroz de Polvo,2.0,2026-06-03
Arroz de Rabo de Boi,1.0,2026-06-03
Arroz de Tamboril,1.0,2026-06-03
Azeitonas,1.0,2026-06-03
BR Burmester meia gr.,1.0,2026-06-03
BR GALHARDINI,1.0,2026-06-03
BR Papa Figos,1.0,2026-06-03
BR Volupia,1.0,2026-06-03
Bacalhau à Brás,3.0,2026-06-03
Bacalhau à Lagareiro,1.0,2026-06-03
Bebida Dia,12.0,2026-06-03
Black Label,1.0,2026-06-03
Café,11.0,2026-06-03
Camarão costa (Peq.),1.0,2026-06-03
Camarão da Costa,1.0,2026-06-03
Cesto de Pão,1.0,2026-06-03
Coca-Cola,1.0,2026-06-03
Couvert,10.0,2026-06-03
Delicia de Chocolate,1.0,2026-06-03
Doce da casa,1.0,2026-06-03
Dourada/Robalo Grelhado,3.0,2026-06-03
Entrecôte,1.0,2026-06-03
Filetes Peixe Galo,6.0,2026-06-03
Filetes de Polvo,1.0,2026-06-03
Fino,13.0,2026-06-03
Menu Dia,15.4,2026-06-03
"Menu Dia,Prato do dia Carne,Bebida Dia",2.6,2026-06-03
Mouse,2.0,2026-06-03
Pera Bêbada,3.0,2026-06-03
Posta,1.0,2026-06-03
Prato do dia Carne,10.0,2026-06-03
Prato do dia Peixe,8.0,2026-06-03
Pudim,3.0,2026-06-03
RS Titular Rosé,1.0,2026-06-03
Sandwich Club,1.0,2026-06-03
Sopa de Marisco,1.0,2026-06-03
Sopa de Peixe,1.0,2026-06-03
TT S. Domingos Reserva,1.0,2026-06-03
Tostas de Rabo de Boi,3.0,2026-06-03
V Muralhas,1.0,2026-06-03
Vegetariano,1.0,2026-06-03
Vinho 0.5L,3.0,2026-06-03
Vinho 1L,2.0,2026-06-03
Vinho Branco da casa (copo),3.0,2026-06-03
Vinho Menu,1.0,2026-06-03
Vinho Tinto da casa (copo),1.0,2026-06-03
Água 0.5L,8.0,2026-06-03
Água Menu,6.0,2026-06-03
Ameijoas à Bulhão Pato,2.0,2026-06-04
Arroz de Pato,3.0,2026-06-04
Arroz de Polvo,2.0,2026-06-04
Arroz de Rabo de Boi,1.0,2026-06-04
Arroz de Tamboril,1.0,2026-06-04
BR Monte Peceguinha,1.0,2026-06-04
BR Qta Lemos D.Paulette,1.0,2026-06-04
Bacalhau à Brás,1.0,2026-06-04
Bacalhau à Lagareiro,1.0,2026-06-04
Bacalhau à Narcisa,1.0,2026-06-04
Bebida Dia,4.0,2026-06-04
Bife Lombo,2.0,2026-06-04
Bife de Atum,2.0,2026-06-04
Bolinhas Alheira (6 Un.),1.0,2026-06-04
Bolinhas de Alheira (3 Un.),1.0,2026-06-04
Café,19.0,2026-06-04
Caldo Verde,1.0,2026-06-04
Camarao ao alho,1.0,2026-06-04
Cesto de Pão,1.0,2026-06-04
Coca-Cola,16.0,2026-06-04
Compal Néctar,2.0,2026-06-04
Couvert,15.0,2026-06-04
Delicia de Chocolate,2.0,2026-06-04
Doce da casa,7.0,2026-06-04
ES S. Domingos Extra Reserva,1.0,2026-06-04
Entrecôte,1.0,2026-06-04
Filetes Peixe Galo,31.0,2026-06-04
Filetes de Polvo,8.5,2026-06-04
Fino,11.0,2026-06-04
Fruta Tropical,2.0,2026-06-04
Ice Tea,4.0,2026-06-04
Magret de Pato,1.0,2026-06-04
Melão com Presunto,2.0,2026-06-04
Menu Dia,2.0,2026-06-04
Mouse,7.0,2026-06-04
Ovos Rotos,3.0,2026-06-04
Pica-Pau Terra e Mar,1.0,2026-06-04
Picanha,1.0,2026-06-04
Polvo à Lagareiro,1.0,2026-06-04
Prato do dia Peixe,4.0,2026-06-04
Prego,1.0,2026-06-04
Pudim,1.0,2026-06-04
Queijo Couvert,1.0,2026-06-04
Sangria 1L,1.0,2026-06-04
Sopa,2.0,2026-06-04
Sopa de Peixe,2.0,2026-06-04
Take Away,2.0,2026-06-04
Tostas de Rabo de Boi,2.0,2026-06-04
V Muralhas,1.0,2026-06-04
Vinho 0.5L,2.0,2026-06-04
Vinho Branco da casa (copo),1.0,2026-06-04
Vinho Menu,1.0,2026-06-04
Vinho Tinto da casa (copo),1.0,2026-06-04
Água 0.5L,12.0,2026-06-04
Ameijoas à Bulhão Pato,1.0,2026-06-05
BR Monte Peceguinha,1.0,2026-06-05
BR Ribeiro Santo Encruzado,1.0,2026-06-05
Bacalhau à Brás,2.0,2026-06-05
Bebida Dia,6.0,2026-06-05
Bife de Atum,4.0,2026-06-05
Café,48.0,2026-06-05
Camarao ao alho,1.0,2026-06-05
Cesto de Pão,1.0,2026-06-05
Couvert,9.0,2026-06-05
Dourada/Robalo Grelhado,8.0,2026-06-05
ES Ortigão Nektar,2.0,2026-06-05
Filetes Peixe Galo,13.5,2026-06-05
Filetes de Polvo,9.5,2026-06-05
Fino,2.0,2026-06-05
Fruta,3.0,2026-06-05
Ice Tea,2.0,2026-06-05
Maça Assada,2.0,2026-06-05
Menu 35€,42.0,2026-06-05
Menu Dia,3.0,2026-06-05
Mouse,1.0,2026-06-05
Pera Bêbada,1.0,2026-06-05
Picanha,1.0,2026-06-05
Prato do dia Carne,2.0,2026-06-05
Prato do dia Peixe,4.0,2026-06-05
Pudim,1.0,2026-06-05
Sopa,2.0,2026-06-05
Sopa de Marisco,2.0,2026-06-05
Sopa de Peixe,3.0,2026-06-05
Take Away,2.0,2026-06-05
Vinho Menu,28.0,2026-06-05
Vinho Tinto da casa (copo),1.0,2026-06-05
Água 0.5L,9.0,2026-06-05
Ameijoas à Bulhão Pato,3.0,2026-06-06
Arroz de Polvo,1.0,2026-06-06
Arroz de Tamboril,4.0,2026-06-06
BR Dona Matilde,1.0,2026-06-06
BR Monte Peceguinha,1.0,2026-06-06
BR Ribeiro Santo Encruzado,3.0,2026-06-06
BR Valle do Nídeo,1.0,2026-06-06
Bacalhau à Brás,1.0,2026-06-06
Bacalhau à Lagareiro,1.0,2026-06-06
Bacalhau à Narcisa,7.0,2026-06-06
Batata dose,3.0,2026-06-06
Beirão,1.0,2026-06-06
Bife Lombo,1.0,2026-06-06
Bife de Atum,2.0,2026-06-06
Bolinhas Alheira (6 Un.),1.0,2026-06-06
Café,25.0,2026-06-06
Caldo Verde,3.0,2026-06-06
Camarao ao alho,2.0,2026-06-06
Camarão da Costa,2.0,2026-06-06
Cataplana de Peixe 2Pax,2.0,2026-06-06
Cesto de Pão,3.0,2026-06-06
Coca-Cola,4.0,2026-06-06
Couvert,16.0,2026-06-06
Doce da casa,6.0,2026-06-06
Dourada/Robalo Grelhado,4.0,2026-06-06
Entrecôte,5.0,2026-06-06
Filetes Peixe Galo,13.5,2026-06-06
Filetes de Polvo,15.5,2026-06-06
Fino,11.0,2026-06-06
Fruta,1.0,2026-06-06
Ice Tea,3.0,2026-06-06
Maça Assada,4.0,2026-06-06
Mini Sagres,4.0,2026-06-06
Mouse,2.0,2026-06-06
Ovo estrelado,1.0,2026-06-06
Pera Bêbada,2.0,2026-06-06
Pudim,1.0,2026-06-06
Salada,2.0,2026-06-06
Sangria 1.5L,3.0,2026-06-06
Sangria 1L,1.0,2026-06-06
Seven Up,1.0,2026-06-06
Sopa de Peixe,3.0,2026-06-06
TT Burmester meia gr.,1.0,2026-06-06
Take Away,3.0,2026-06-06
Tostas de Rabo de Boi,3.0,2026-06-06
Vinho 0.5L,2.0,2026-06-06
Vinho 1L,1.0,2026-06-06
Vinho Branco da casa (copo),2.0,2026-06-06
Vinho Tinto da casa (copo),1.0,2026-06-06
Água 0.5L,18.0,2026-06-06
Água c/gás,1.0,2026-06-06
Ameijoas à Bulhão Pato,2.0,2026-06-08
Arroz de Polvo,2.0,2026-06-08
Arroz de Tamboril,2.0,2026-06-08
BR Ribeiro Santo Encruzado,1.0,2026-06-08
Bacalhau à Lagareiro,5.0,2026-06-08
Bebida Dia,22.0,2026-06-08
Bife Lombo,1.0,2026-06-08
Bolinhas Alheira (6 Un.),2.0,2026-06-08
Bolinhas de Alheira (3 Un.),1.0,2026-06-08
Café,18.0,2026-06-08
Caldo Verde,1.0,2026-06-08
Camarao ao alho,1.0,2026-06-08
Camarão da Costa,2.0,2026-06-08
Cerveja S/Alcool,1.0,2026-06-08
Cesto de Pão,2.0,2026-06-08
Coca-Cola,2.0,2026-06-08
Couvert,12.0,2026-06-08
Coxa de Pato Confitada,1.0,2026-06-08
Doce da casa,6.0,2026-06-08
Dourada/Robalo Grelhado,6.0,2026-06-08
Entrecôte,1.0,2026-06-08
Filetes Peixe Galo,6.0,2026-06-08
Filetes de Polvo,1.0,2026-06-08
Fino,17.0,2026-06-08
Fruta Tropical,2.0,2026-06-08
Menu Dia,11.0,2026-06-08
Mouse,1.0,2026-06-08
Pera Bêbada,1.0,2026-06-08
Pica-Pau Terra e Mar,1.0,2026-06-08
Pica-pau,1.0,2026-06-08
Picanha,2.0,2026-06-08
Polvo Ensalsado,1.0,2026-06-08
Prato do dia Carne,4.0,2026-06-08
Prato do dia Peixe,18.0,2026-06-08
Pudim,2.0,2026-06-08
RS Papa Figos,1.0,2026-06-08
Salada,3.0,2026-06-08
Sangria 1.5L,1.0,2026-06-08
Sopa,1.0,2026-06-08
Sopa de Marisco,1.0,2026-06-08
Sopa de Peixe,2.0,2026-06-08
TT Duvalley,1.0,2026-06-08
TT Monte Peceguinha,1.0,2026-06-08
TT Papa Figos,2.0,2026-06-08
Take Away,7.0,2026-06-08
Taça de Gelado,2.0,2026-06-08
Vegetariano,1.0,2026-06-08
Vinho 0.5L,2.0,2026-06-08
Vinho Branco da casa (copo),2.0,2026-06-08
Água 0.5L,5.0,2026-06-08
Água c/gás,2.0,2026-06-08
Ameijoas à Bulhão Pato,1.0,2026-06-09
BR Luis Pato Maria Gomes,3.0,2026-06-09
BR Planalto,1.0,2026-06-09
Bacalhau à Brás,4.0,2026-06-09
Batata dose,1.0,2026-06-09
Bebida Dia,10.0,2026-06-09
Bife Lombo,1.0,2026-06-09
Bolinhas Alheira (6 Un.),1.0,2026-06-09
Café,40.0,2026-06-09
Camarao ao alho,1.0,2026-06-09
Carne de Porco à Alentejana,1.0,2026-06-09
Cesto de Pão,1.0,2026-06-09
Coca-Cola,2.0,2026-06-09
Couvert,7.0,2026-06-09
Doce da casa,10.0,2026-06-09
Entrecôte,2.0,2026-06-09
Filetes Peixe Galo,11.5,2026-06-09
Filetes de Polvo,1.0,2026-06-09
Ice Tea,1.0,2026-06-09
Martini,1.0,2026-06-09
Menu 25€,5.0,2026-06-09
Menu 35€,24.0,2026-06-09
Menu Degustação Simples,10.0,2026-06-09
Menu Dia,8.0,2026-06-09
Mini Sagres,6.0,2026-06-09
Mouse,1.0,2026-06-09
Pera Bêbada,1.0,2026-06-09
Picanha,1.0,2026-06-09
Polvo à Lagareiro,1.0,2026-06-09
Prato do dia Carne,2.0,2026-06-09
Prato do dia Peixe,14.0,2026-06-09
Sopa,1.0,2026-06-09
Sopa de Peixe,2.0,2026-06-09
TT Papa Figos,1.0,2026-06-09
TT V.Nídeo Reserva,1.0,2026-06-09
Take Away,4.0,2026-06-09
Vinho Menu,12.0,2026-06-09
Água 0.5L,2.0,2026-06-09
Água Menu,22.0,2026-06-09
Água c/gás,5.0,2026-06-09
Ameijoas à Bulhão Pato,1.0,2026-06-10
Arroz de Polvo,1.0,2026-06-10
Arroz de Rabo de Boi,2.0,2026-06-10
Arroz de Tamboril,2.0,2026-06-10
BR Dona Matilde,1.0,2026-06-10
BR Ribeiro Santo Encruzado,3.0,2026-06-10
Bacalhau à Brás,2.0,2026-06-10
Bacalhau à Lagareiro,1.0,2026-06-10
Bebida Dia,20.0,2026-06-10
Bife Lombo,2.0,2026-06-10
Bolinhas Alheira (6 Un.),1.0,2026-06-10
Bolinhas de Alheira (3 Un.),1.0,2026-06-10
Café,26.0,2026-06-10
Camarao ao alho,2.0,2026-06-10
Carne de Porco à Alentejana,1.0,2026-06-10
Coca-Cola,5.0,2026-06-10
Couvert,15.0,2026-06-10
Doce da casa,4.0,2026-06-10
Dourada/Robalo Grelhado,2.0,2026-06-10
Filetes Peixe Galo,7.0,2026-06-10
Filetes de Polvo,5.0,2026-06-10
Fino,3.0,2026-06-10
Ice Tea,1.0,2026-06-10
Jameson,1.0,2026-06-10
Magret de Pato,2.0,2026-06-10
Maça Assada,5.0,2026-06-10
Menu Dia,10.0,2026-06-10
Mouse,2.0,2026-06-10
Ovos Rotos,1.0,2026-06-10
Pera Bêbada,1.0,2026-06-10
Pica-pau,1.0,2026-06-10
Picanha,1.0,2026-06-10
Polvo à Lagareiro,1.0,2026-06-10
Posta,2.0,2026-06-10
Prato do dia Carne,6.0,2026-06-10
Prato do dia Peixe,14.0,2026-06-10
Queijo Couvert,1.0,2026-06-10
Salada,2.0,2026-06-10
Sangria 1L,1.0,2026-06-10
Sangria Espumante 1.5L,1.0,2026-06-10
Sopa de Peixe,2.0,2026-06-10
Take Away,5.0,2026-06-10
Vinho 0.5L,4.0,2026-06-10
Vinho Menu,1.0,2026-06-10
Água 0.5L,10.0,2026-06-10
Água c/gás,3.0,2026-06-10
Ameijoas à Bulhão Pato,1.0,2026-06-11
Arroz Conquilhas,1.0,2026-06-11
Arroz de Tamboril,1.0,2026-06-11
Bacalhau à Brás,2.0,2026-06-11
Bebida Dia,18.0,2026-06-11
CRF-Reserva,1.0,2026-06-11
Café,14.0,2026-06-11
Caldo Verde,3.0,2026-06-11
Camarão costa (Peq.),1.0,2026-06-11
Camarão da Costa,2.0,2026-06-11
Carne de Porco à Alentejana,5.0,2026-06-11
Cesto de Pão,1.0,2026-06-11
Coca-Cola,2.0,2026-06-11
Couvert,12.0,2026-06-11
Coxa de Pato Confitada,1.0,2026-06-11
Doce da casa,6.0,2026-06-11
Dourada/Robalo Grelhado,3.0,2026-06-11
Entrecôte,1.0,2026-06-11
Filetes Peixe Galo,2.0,2026-06-11
Fino,2.0,2026-06-11
Ice Tea,2.0,2026-06-11
Massada de Peixe,2.0,2026-06-11
Maça Assada,2.0,2026-06-11
Menu Dia,11.0,2026-06-11
Mouse,2.0,2026-06-11
Pica-pau,1.0,2026-06-11
Picanha,2.0,2026-06-11
Polvo Ensalsado,1.0,2026-06-11
Prato do dia Carne,10.0,2026-06-11
Prato do dia Peixe,12.0,2026-06-11
Queijo Couvert,1.0,2026-06-11
Salada,2.0,2026-06-11
Seven Up,3.0,2026-06-11
Sopa de Peixe,1.0,2026-06-11
TT Dona Matilde Res,1.0,2026-06-11
TT V.Nídeo Reserva,1.0,2026-06-11
Vinho 0.5L,4.0,2026-06-11
Vinho 1L,1.0,2026-06-11
Vinho Branco da casa (copo),3.0,2026-06-11
Vinho Menu,2.0,2026-06-11
Água 0.5L,4.0,2026-06-11
Água Menu,4.0,2026-06-11
Água c/gás,6.0,2026-06-11
Alheira,1.0,2026-06-12
Ameijoas à Bulhão Pato,1.0,2026-06-12
Arroz de Rabo de Boi,4.0,2026-06-12
Arroz de Tamboril,1.0,2026-06-12
BR Dona Matilde,1.0,2026-06-12
BR Luis Pato Maria Gomes,1.0,2026-06-12
BR Luis Pato Vinhas Velhas,3.0,2026-06-12
BR Ribeiro Santo Encruzado,1.0,2026-06-12
Bacalhau à Brás,2.0,2026-06-12
Bacalhau à Lagareiro,1.0,2026-06-12
Bebida Dia,28.0,2026-06-12
Bife de Atum,1.0,2026-06-12
Bolinhas de Alheira (3 Un.),2.0,2026-06-12
Café,29.0,2026-06-12
Caldo Verde,1.0,2026-06-12
Camarao ao alho,2.0,2026-06-12
Cesto de Pão,2.0,2026-06-12
Coca-Cola,1.0,2026-06-12
Couvert,11.0,2026-06-12
Coxa de Pato Confitada,1.0,2026-06-12
Doce da casa,8.0,2026-06-12
Filetes Peixe Galo,9.0,2026-06-12
Filetes de Polvo,3.0,2026-06-12
Fino,24.0,2026-06-12
Magret de Pato,1.0,2026-06-12
Maça Assada,3.0,2026-06-12
Menu 25€,3.0,2026-06-12
Menu Degustação Simples,6.0,2026-06-12
Menu Dia,16.0,2026-06-12
Mini Sagres,9.0,2026-06-12
Pera Bêbada,1.0,2026-06-12
Picanha,1.0,2026-06-12
Prato do dia Carne,8.0,2026-06-12
Prato do dia Peixe,24.0,2026-06-12
Salada,1.0,2026-06-12
Sopa,1.0,2026-06-12
Sopa de Peixe,2.0,2026-06-12
TT Papa Figos,2.0,2026-06-12
Take Away,1.0,2026-06-12
V Regueiro,1.0,2026-06-12
Vegetariano,1.0,2026-06-12
Vinho 0.5L,3.0,2026-06-12
Vinho 1L,1.0,2026-06-12
Vinho Menu,8.0,2026-06-12
Água 0.5L,10.0,2026-06-12
Água Menu,4.0,2026-06-12
Água c/gás,6.0,2026-06-12
Ameijoas à Bulhão Pato,2.0,2026-06-13
Arroz de Polvo,2.0,2026-06-13
BR Dona Matilde,2.0,2026-06-13
BR Luis Pato Maria Gomes,1.0,2026-06-13
BR Vinha Grande,1.0,2026-06-13
Bacalhau à Lagareiro,2.0,2026-06-13
Bacalhau à Narcisa,6.0,2026-06-13
Bebida Dia,50.0,2026-06-13
Bife de Atum,1.0,2026-06-13
Café,92.0,2026-06-13
Camarao ao alho,1.0,2026-06-13
Camarão da Costa,1.0,2026-06-13
Carne de Porco à Alentejana,1.0,2026-06-13
Cesto de Pão,2.0,2026-06-13
Coca-Cola,8.0,2026-06-13
Couvert,11.0,2026-06-13
Cozido à Portuguesa,2.0,2026-06-13
Doce da casa,3.0,2026-06-13
Dourada/Robalo Grelhado,1.0,2026-06-13
ES S. Domingos Extra Reserva,1.0,2026-06-13
Entrecôte,1.0,2026-06-13
Filetes Peixe Galo,9.0,2026-06-13
Filetes de Polvo,1.0,2026-06-13
Fino,3.0,2026-06-13
Ice Tea,1.0,2026-06-13
Maça Assada,1.0,2026-06-13
Menu 35€,58.0,2026-06-13
"Menu 35€,Menu 35€,Bebida Dia,Café",26.0,2026-06-13
Menu Dia,4.0,2026-06-13
Omelete Camarão,1.0,2026-06-13
Ovos Rotos,1.0,2026-06-13
Picanha,1.0,2026-06-13
Polvo à Lagareiro,2.0,2026-06-13
Prato do dia Carne,2.0,2026-06-13
Prato do dia Peixe,6.0,2026-06-13
Pudim,1.0,2026-06-13
Sandwich Club,1.0,2026-06-13
Take Away,1.0,2026-06-13
Vinho 0.5L,3.0,2026-06-13
Vinho Menu,1.0,2026-06-13
Água 0.5L,14.0,2026-06-13
Água c/gás,2.0,2026-06-13
Ameijoas à Bulhão Pato,1.0,2026-06-15
Arroz de Polvo,1.0,2026-06-15
Arroz de Rabo de Boi,1.0,2026-06-15
Arroz de Tamboril,3.0,2026-06-15
BR Ribeiro Santo Encruzado,1.0,2026-06-15
Batata dose,1.0,2026-06-15
Bebida Dia,20.0,2026-06-15
Bife Lombo,1.0,2026-06-15
Bife de Atum,1.0,2026-06-15
Bolinhas Alheira (6 Un.),3.0,2026-06-15
Café,12.0,2026-06-15
Camarao ao alho,2.0,2026-06-15
Camarão costa (Peq.),1.0,2026-06-15
Coca-Cola,3.0,2026-06-15
Compal Néctar,1.0,2026-06-15
Couvert,13.0,2026-06-15
Doce da casa,2.0,2026-06-15
E S.Domingos,1.0,2026-06-15
Entrecôte,2.0,2026-06-15
Filetes Peixe Galo,10.0,2026-06-15
Filetes de Polvo,2.0,2026-06-15
Fino,6.0,2026-06-15
Ice Tea,2.0,2026-06-15
Manteiga,1.0,2026-06-15
Maça Assada,1.0,2026-06-15
Melão com Presunto,1.0,2026-06-15
Menu Dia,10.0,2026-06-15
Mouse,4.0,2026-06-15
Ovos Rotos,1.0,2026-06-15
Pera Bêbada,4.0,2026-06-15
Pica-Pau Terra e Mar,1.0,2026-06-15
Pica-pau,1.0,2026-06-15
Picanha,2.0,2026-06-15
Polvo Ensalsado,1.0,2026-06-15
Polvo à Lagareiro,1.0,2026-06-15
Prato do dia Carne,10.0,2026-06-15
Prato do dia Peixe,10.0,2026-06-15
Prego,2.0,2026-06-15
Sopa,4.0,2026-06-15
Sopa de Marisco,1.0,2026-06-15
TT Dona Matilde,1.0,2026-06-15
TT V.Nídeo Reserva,2.0,2026-06-15
Take Away,3.0,2026-06-15
Vinho 0.5L,4.0,2026-06-15
Vinho Branco da casa (copo),2.0,2026-06-15
Vinho Menu,1.0,2026-06-15
Água 0.5L,7.0,2026-06-15
Água c/gás,1.0,2026-06-15
Alheira,1.0,2026-06-16
Ameijoas à Bulhão Pato,3.0,2026-06-16
Arroz de Rabo de Boi,1.0,2026-06-16
Arroz de Tamboril,2.0,2026-06-16
BR Monte Peceguinha,1.0,2026-06-16
Bacalhau à Brás,3.0,2026-06-16
Bebida Dia,18.0,2026-06-16
Bolinhas Alheira (6 Un.),2.0,2026-06-16
Café,11.0,2026-06-16
Camarao ao alho,3.0,2026-06-16
Camarão da Costa,2.0,2026-06-16
Cesto de Pão,3.0,2026-06-16
Couvert,5.0,2026-06-16
Delicia de Chocolate,2.0,2026-06-16
Doce da casa,1.0,2026-06-16
ES Quinta Monteirinhos,3.0,2026-06-16
Filetes Peixe Galo,4.0,2026-06-16
Filetes de Polvo,2.0,2026-06-16
Menu 25€,7.0,2026-06-16
Menu Degustação Simples,14.0,2026-06-16
Menu Dia,9.0,2026-06-16
Pica-pau,1.0,2026-06-16
Prato do dia Carne,12.0,2026-06-16
Prato do dia Peixe,6.0,2026-06-16
Queijo Couvert,1.0,2026-06-16
Salada,1.0,2026-06-16
Sopa,2.0,2026-06-16
Sopa de Marisco,1.0,2026-06-16
Sopa de Peixe,4.0,2026-06-16
Take Away,4.0,2026-06-16
Vinho Menu,3.0,2026-06-16
Água 0.5L,2.0,2026-06-16
Água Menu,14.0,2026-06-16
Água c/gás,3.0,2026-06-16
Alheira,1.0,2026-06-17
BR Ribeiro Santo Encruzado,3.0,2026-06-17
BR V. Nídeo SauvignonBlanc,2.0,2026-06-17
Bacalhau à Brás,1.0,2026-06-17
Bebida Dia,52.0,2026-06-17
Bife Lombo,1.0,2026-06-17
CRF-Reserva,2.0,2026-06-17
Café,74.0,2026-06-17
Carne de Porco à Alentejana,1.0,2026-06-17
Cesto de Pão,1.0,2026-06-17
Coca-Cola,2.0,2026-06-17
Couvert,8.0,2026-06-17
Coxa de Pato Confitada,1.0,2026-06-17
Delicia de Chocolate,1.0,2026-06-17
Doce da casa,1.0,2026-06-17
Dourada/Robalo Grelhado,2.0,2026-06-17
Filetes Peixe Galo,3.0,2026-06-17
Filetes de Polvo,2.0,2026-06-17
Fino,4.0,2026-06-17
Maça Assada,1.0,2026-06-17
Menu 35€,42.0,2026-06-17
Menu Dia,12.0,2026-06-17
Mouse,1.0,2026-06-17
Ovos Rotos,2.0,2026-06-17
Pera Bêbada,1.0,2026-06-17
Pica-Pau Terra e Mar,1.0,2026-06-17
Polvo Ensalsado,1.0,2026-06-17
Polvo à Lagareiro,1.0,2026-06-17
Prato do dia Carne,6.0,2026-06-17
Prato do dia Peixe,18.0,2026-06-17
TT Papa Figos,1.0,2026-06-17
Taça de Gelado,1.0,2026-06-17
V Muralhas,1.0,2026-06-17
Vinho 0.5L,2.0,2026-06-17
Água 0.5L,4.0,2026-06-17
Água c/gás,2.0,2026-06-17
Arroz dose,1.0,2026-06-18
BR Papa Figos,2.0,2026-06-18
Bacalhau à Brás,3.0,2026-06-18
Bacalhau à Lagareiro,1.0,2026-06-18
Batata dose,1.0,2026-06-18
Bebida Dia,20.0,2026-06-18
Bife de Atum,2.0,2026-06-18
Bolinhas Alheira (6 Un.),1.0,2026-06-18
Café,21.0,2026-06-18
Camarão costa (Peq.),1.0,2026-06-18
Carne de Porco à Alentejana,3.0,2026-06-18
Cesto de Pão,2.0,2026-06-18
Coca-Cola,1.0,2026-06-18
Couvert,8.0,2026-06-18
Doce da casa,1.0,2026-06-18
Dourada/Robalo Grelhado,1.0,2026-06-18
Entrecôte,2.0,2026-06-18
Filetes Peixe Galo,2.0,2026-06-18
Filetes de Polvo,2.0,2026-06-18
Fino,9.0,2026-06-18
Fruta Tropical,3.0,2026-06-18
Ice Tea,2.0,2026-06-18
Manteiga,1.0,2026-06-18
Menu Dia,10.0,2026-06-18
Mouse,1.0,2026-06-18
Omelete Camarão,2.0,2026-06-18
Pera Bêbada,1.0,2026-06-18
Pica-pau,1.0,2026-06-18
Picanha,1.0,2026-06-18
Prato do dia Carne,12.0,2026-06-18
Prato do dia Peixe,8.0,2026-06-18
Prego,1.0,2026-06-18
RS Titular Rosé,1.0,2026-06-18
Sopa,2.0,2026-06-18
TT Monte Peceguinha,1.0,2026-06-18
Vinho 0.5L,3.0,2026-06-18
Vinho 1L,2.0,2026-06-18
Vinho Branco da casa (copo),1.0,2026-06-18
Água 0.5L,7.0,2026-06-18
Água c/gás,4.0,2026-06-18
Azeitonas,1.0,2026-06-19
Bacalhau à Brás,1.0,2026-06-19
Bebida Dia,26.0,2026-06-19
Bife de Atum,2.0,2026-06-19
Café,70.0,2026-06-19
Couvert,3.0,2026-06-19
Doce da casa,1.0,2026-06-19
E S.Domingos,2.0,2026-06-19
Fruta Tropical,1.0,2026-06-19
Menu 30€,9.11,2026-06-19
"Menu 30€,Menu Degustação Intermédio,Água Menu,Café",45.54,2026-06-19
Menu Degustação Intermédio,56.0,2026-06-19
Menu Dia,24.98,2026-06-19
Mouse,1.0,2026-06-19
Nordés,1.0,2026-06-19
Pera Bêbada,2.0,2026-06-19
Prato do dia Carne,8.0,2026-06-19
Prato do dia Peixe,18.0,2026-06-19
Vinho 0.5L,1.0,2026-06-19
Vinho Branco da casa (copo),1.0,2026-06-19
Vinho Menu,2.0,2026-06-19
Água Menu,54.0,2026-06-19
Alheira,2.0,2026-06-20
Arroz Doce,3.0,2026-06-20
Arroz de Marisco 2Pax,1.0,2026-06-20
Arroz de Polvo,1.0,2026-06-20
Arroz de Rabo de Boi,2.0,2026-06-20
Azeitonas,1.0,2026-06-20
BR Planalto,1.0,2026-06-20
BR Ribeiro Santo Encruzado,2.0,2026-06-20
Bacalhau à Brás,5.0,2026-06-20
Bacalhau à Narcisa,1.0,2026-06-20
Batata dose,1.0,2026-06-20
Bebida Dia,8.0,2026-06-20
Bife de Atum,1.0,2026-06-20
Bolinhas Alheira (6 Un.),1.0,2026-06-20
Café,19.0,2026-06-20
Camarão costa (Peq.),1.0,2026-06-20
Camarão da Costa,1.0,2026-06-20
Carne de Porco à Alentejana,1.0,2026-06-20
Cesto de Pão,2.0,2026-06-20
Chá,2.0,2026-06-20
Coca-Cola,2.0,2026-06-20
Couvert,11.0,2026-06-20
Coxa de Pato Confitada,1.0,2026-06-20
Doce da casa,7.0,2026-06-20
Dourada/Robalo Grelhado,3.0,2026-06-20
Entrecôte,2.0,2026-06-20
Filetes Peixe Galo,23.5,2026-06-20
Filetes de Polvo,1.0,2026-06-20
Fino,8.0,2026-06-20
Manteiga,2.0,2026-06-20
Maça Assada,1.0,2026-06-20
Menu Dia,4.0,2026-06-20
Mouse,2.0,2026-06-20
Ovo estrelado,3.0,2026-06-20
Pera Bêbada,4.0,2026-06-20
Pica-pau,1.0,2026-06-20
Picanha,1.0,2026-06-20
Prato do dia Carne,4.0,2026-06-20
Prato do dia Peixe,4.0,2026-06-20
Pudim,2.0,2026-06-20
Queijo Couvert,2.0,2026-06-20
Sangria Espumante 1.5L,1.0,2026-06-20
Sopa de Peixe,3.0,2026-06-20
Take Away,9.0,2026-06-20
Taça de Gelado,3.0,2026-06-20
Vinho 0.5L,5.0,2026-06-20
Vinho 1L,4.0,2026-06-20
Vinho Branco da casa (copo),2.0,2026-06-20
Vinho Menu,1.0,2026-06-20
Vinho Tinto da casa (copo),1.0,2026-06-20
Água 0.33L,1.0,2026-06-20
Água 0.5L,13.0,2026-06-20
Água c/gás,5.0,2026-06-20
Arroz Doce,1.0,2026-06-22
Arroz de Lavagante,2.0,2026-06-22
Arroz dose,1.0,2026-06-22
BR Dona Matilde,3.0,2026-06-22
BR Papa Figos,1.0,2026-06-22
BR Ribeiro Santo Encruzado,1.0,2026-06-22
BR Vinha Grande,2.0,2026-06-22
Bacalhau à Brás,2.0,2026-06-22
Bacalhau à Lagareiro,1.0,2026-06-22
Batata dose,2.0,2026-06-22
Bebida Dia,52.0,2026-06-22
Bife Lombo,1.0,2026-06-22
Bife de Atum,3.0,2026-06-22
Bolinhas Alheira (6 Un.),1.0,2026-06-22
Bolinhas de Alheira (3 Un.),1.0,2026-06-22
Café,21.0,2026-06-22
Caldo Verde,2.0,2026-06-22
Camarao ao alho,1.0,2026-06-22
Cerveja S/Alcool,2.0,2026-06-22
Cesto de Pão,1.0,2026-06-22
Coca-Cola,6.0,2026-06-22
Couvert,11.0,2026-06-22
Doce da casa,3.0,2026-06-22
Entrecôte,1.0,2026-06-22
Filetes Peixe Galo,9.5,2026-06-22
Filetes de Polvo,3.5,2026-06-22
Fino,11.0,2026-06-22
Fruta Tropical,3.0,2026-06-22
Ice Tea,1.0,2026-06-22
Legumes Salteados,1.0,2026-06-22
Menu Dia,26.0,2026-06-22
Mouse,3.0,2026-06-22
Omelete Camarão,1.0,2026-06-22
Ovos Rotos,1.0,2026-06-22
Pera Bêbada,1.0,2026-06-22
Picanha,1.0,2026-06-22
Porto 10 anos Tawny,2.0,2026-06-22
Prato do dia Carne,12.0,2026-06-22
Prato do dia Peixe,40.0,2026-06-22
Pudim,3.0,2026-06-22
Sangria 1.5L,1.0,2026-06-22
Sopa,1.0,2026-06-22
Sopa de Peixe,5.0,2026-06-22
TT Ribeiro Santo Res,1.0,2026-06-22
Take Away,1.0,2026-06-22
Tostas de Rabo de Boi,2.0,2026-06-22
Vegetariano,1.0,2026-06-22
Vinho 0.5L,2.0,2026-06-22
Vinho Menu,1.0,2026-06-22
Água 0.5L,4.0,2026-06-22
Água c/gás,4.0,2026-06-22
Bebida Dia,234.0,2026-06-23
Black Label,2.0,2026-06-23
Café,234.0,2026-06-23
Menu 30€,117.0,2026-06-23
Menu Degustação Intermédio,234.0,2026-06-23
BR Ribeiro Santo Encruzado,1.0,2026-06-24
Bebida Dia,4.0,2026-06-24
Café,3.0,2026-06-24
Cesto de Pão,6.0,2026-06-24
Chá,4.0,2026-06-24
Coca-Cola,2.0,2026-06-24
Doce da casa,3.0,2026-06-24
Entrecôte,7.0,2026-06-24
Filetes Peixe Galo,10.0,2026-06-24
Maça Assada,5.0,2026-06-24
Menu Dia,2.0,2026-06-24
Mouse,4.0,2026-06-24
Pera Bêbada,1.0,2026-06-24
Prato Enchidos,4.0,2026-06-24
Prato do dia Carne,2.0,2026-06-24
Prato do dia Peixe,2.0,2026-06-24
Pudim,1.0,2026-06-24
Queijo Couvert,2.0,2026-06-24
RS Papa Figos,1.0,2026-06-24
Água 0.5L,16.0,2026-06-24
Arroz de Rabo de Boi,1.0,2026-06-25
BR Dona Matilde,1.0,2026-06-25
BR V. Nídeo SauvignonBlanc,1.0,2026-06-25
Bacalhau à Brás,5.0,2026-06-25
Bebida Dia,18.0,2026-06-25
Bife Lombo,1.0,2026-06-25
Brandy Croft,1.0,2026-06-25
CRF-Reserva,2.0,2026-06-25
Café,17.0,2026-06-25
Camarao ao alho,1.0,2026-06-25
Carne de Porco à Alentejana,1.0,2026-06-25
Cesto de Pão,2.0,2026-06-25
Coca-Cola,2.0,2026-06-25
Couvert,6.0,2026-06-25
Doce da casa,3.0,2026-06-25
Entrecôte,2.0,2026-06-25
Filetes Peixe Galo,4.0,2026-06-25
Filetes de Polvo,2.0,2026-06-25
Fino,1.0,2026-06-25
Fruta,1.0,2026-06-25
Gordons,1.0,2026-06-25
Ice Tea,2.0,2026-06-25
Legumes Salteados,1.0,2026-06-25
Menu Dia,9.0,2026-06-25
Polvo à Lagareiro,1.0,2026-06-25
Prato do dia Carne,14.0,2026-06-25
Prato do dia Peixe,4.0,2026-06-25
Pudim,1.0,2026-06-25
Queijo Couvert,2.0,2026-06-25
Sopa,3.0,2026-06-25
Take Away,1.0,2026-06-25
V Muralhas,1.0,2026-06-25
Vinho 0.5L,3.0,2026-06-25
Vinho 1L,2.0,2026-06-25
Vinho Menu,1.0,2026-06-25
Vinho Tinto da casa (copo),1.0,2026-06-25
Água 0.5L,4.0,2026-06-25
Água c/gás,1.0,2026-06-25
Alheira,1.0,2026-06-26
Ameijoas à Bulhão Pato,2.0,2026-06-26
Arroz Doce,1.0,2026-06-26
Arroz de Rabo de Boi,1.0,2026-06-26
BR Burmester meia gr.,2.0,2026-06-26
BR Papa Figos,1.0,2026-06-26
BR Ribeiro Santo Encruzado,1.0,2026-06-26
BR Volupia,1.0,2026-06-26
Bacalhau à Brás,2.0,2026-06-26
Bayleys,1.0,2026-06-26
Bebida Dia,18.0,2026-06-26
Bife Lombo,1.0,2026-06-26
Bife de Atum,2.0,2026-06-26
Bolinhas Alheira (6 Un.),1.0,2026-06-26
Café,27.0,2026-06-26
Camarao ao alho,1.0,2026-06-26
Camarão da Costa,1.0,2026-06-26
Cerveja S/Alcool,1.0,2026-06-26
Cesto de Pão,1.0,2026-06-26
Coca-Cola,3.0,2026-06-26
Couvert,13.0,2026-06-26
Doce da casa,2.0,2026-06-26
Dourada/Robalo Grelhado,3.0,2026-06-26
Entrecôte,1.0,2026-06-26
Filetes Peixe Galo,15.5,2026-06-26
Filetes de Polvo,3.0,2026-06-26
Fino,1.0,2026-06-26
Ice Tea,1.0,2026-06-26
Maça Assada,7.0,2026-06-26
Menu 25€,1.0,2026-06-26
Menu Degustação Simples,2.0,2026-06-26
Menu Dia,9.0,2026-06-26
Mouse,2.0,2026-06-26
Pera Bêbada,1.0,2026-06-26
Picanha,1.0,2026-06-26
Polvo à Lagareiro,3.0,2026-06-26
Posta,2.0,2026-06-26
Prato do dia Carne,14.0,2026-06-26
Prato do dia Peixe,4.0,2026-06-26
Pudim,1.0,2026-06-26
RS Papa Figos,1.0,2026-06-26
Salada,3.0,2026-06-26
Sopa de Peixe,7.0,2026-06-26
TT Papa Figos,2.0,2026-06-26
TT V.Nídeo Reserva,1.0,2026-06-26
Take Away,1.0,2026-06-26
Taça de Gelado,7.0,2026-06-26
V Regueiro,1.0,2026-06-26
Vinho 0.5L,2.0,2026-06-26
Vinho 1L,1.0,2026-06-26
Vinho Menu,4.0,2026-06-26
Vinho Tinto da casa (copo),1.0,2026-06-26
Água 0.5L,1.0,2026-06-26
Ameijoas à Bulhão Pato,3.0,2026-06-27
Arroz Doce,1.0,2026-06-27
Arroz de Polvo,1.0,2026-06-27
Arroz de Tamboril,1.0,2026-06-27
BR Dona Matilde,1.0,2026-06-27
BR Monte Peceguinha,1.0,2026-06-27
BR Vinha Grande,2.0,2026-06-27
Bacalhau à Brás,1.0,2026-06-27
Bacalhau à Narcisa,6.0,2026-06-27
Batata dose,2.0,2026-06-27
Bebida Dia,4.0,2026-06-27
Beirão,2.0,2026-06-27
Bife Lombo,2.0,2026-06-27
Café,24.0,2026-06-27
Caldo Verde,1.0,2026-06-27
Camarao ao alho,1.0,2026-06-27
Camarão da Costa,1.0,2026-06-27
Carne de Porco à Alentejana,4.0,2026-06-27
Cesto de Pão,3.0,2026-06-27
Coca-Cola,8.0,2026-06-27
Compal Néctar,1.0,2026-06-27
Couvert,13.0,2026-06-27
Doce da casa,3.0,2026-06-27
Entrecôte,4.0,2026-06-27
Filetes Peixe Galo,21.5,2026-06-27
Filetes de Polvo,6.0,2026-06-27
Fino,21.0,2026-06-27
Fruta Tropical,3.0,2026-06-27
Ice Tea,2.0,2026-06-27
Lombo porco,5.0,2026-06-27
Magret de Pato,1.0,2026-06-27
Maça Assada,2.0,2026-06-27
Menu Dia,2.0,2026-06-27
Mouse,1.0,2026-06-27
Ovos Rotos,1.0,2026-06-27
Pica-pau,1.0,2026-06-27
Picanha,1.0,2026-06-27
Prato do dia Carne,4.0,2026-06-27
Pudim,1.0,2026-06-27
Salada,2.0,2026-06-27
Seven Up,1.0,2026-06-27
Sopa,6.0,2026-06-27
Sopa de Marisco,3.0,2026-06-27
Sopa de Peixe,3.0,2026-06-27
TT Dona Matilde,1.0,2026-06-27
Take Away,7.0,2026-06-27
Taça de Gelado,3.0,2026-06-27
Tostas de Rabo de Boi,5.0,2026-06-27
Vinho 0.5L,4.0,2026-06-27
Vinho Menu,1.0,2026-06-27
Água 0.5L,15.0,2026-06-27
Ameijoas à Bulhão Pato,6.0,2026-06-29
Arroz Doce,1.0,2026-06-29
Arroz de Marisco 2Pax,1.0,2026-06-29
Arroz de Polvo,2.0,2026-06-29
Arroz de Rabo de Boi,1.0,2026-06-29
BR Burmester meia gr.,1.0,2026-06-29
BR Monte Peceguinha,3.0,2026-06-29
BR Papa Figos,1.0,2026-06-29
BR Ribeiro Santo Encruzado,1.0,2026-06-29
BR Valle do Nídeo,1.0,2026-06-29
Bacalhau à Brás,1.0,2026-06-29
Bacalhau à Lagareiro,2.0,2026-06-29
Batata dose,1.0,2026-06-29
Bebida Dia,46.0,2026-06-29
Bife de Atum,7.0,2026-06-29
Bolinhas Alheira (6 Un.),3.0,2026-06-29
Café,26.0,2026-06-29
Caldo Verde,1.0,2026-06-29
Camarao ao alho,3.0,2026-06-29
Camarão da Costa,1.0,2026-06-29
Carne de Porco à Alentejana,3.0,2026-06-29
Cesto de Pão,2.0,2026-06-29
Coca-Cola,8.0,2026-06-29
Compal Néctar,1.0,2026-06-29
Couvert,18.0,2026-06-29
Doce da casa,5.0,2026-06-29
Dourada/Robalo Grelhado,3.0,2026-06-29
Entrecôte,1.0,2026-06-29
Filetes Peixe Galo,13.0,2026-06-29
Filetes de Polvo,2.0,2026-06-29
Fino,16.0,2026-06-29
Fruta,1.0,2026-06-29
Fruta Tropical,2.0,2026-06-29
Legumes Salteados,1.0,2026-06-29
Magret de Pato,2.0,2026-06-29
Martini,2.0,2026-06-29
Maça Assada,6.0,2026-06-29
Melão com Presunto,1.0,2026-06-29
Menu Dia,23.0,2026-06-29
Mouse,3.0,2026-06-29
Ovo estrelado,2.0,2026-06-29
Pera Bêbada,2.0,2026-06-29
Pica-pau,1.0,2026-06-29
Picanha,1.0,2026-06-29
Polvo Ensalsado,1.0,2026-06-29
Polvo à Lagareiro,1.0,2026-06-29
Posta,1.0,2026-06-29
Prato do dia Carne,16.0,2026-06-29
Prato do dia Peixe,30.0,2026-06-29
Pudim,1.0,2026-06-29
Queijo Couvert,1.0,2026-06-29
Salada,2.0,2026-06-29
Sangria 1L,1.0,2026-06-29
Sopa,4.0,2026-06-29
Sopa de Marisco,1.0,2026-06-29
Sopa de Peixe,2.0,2026-06-29
TT Vinha Grande,1.0,2026-06-29
Take Away,3.0,2026-06-29
Taça de Gelado,1.0,2026-06-29
Tostas de Rabo de Boi,1.0,2026-06-29
V Muralhas,1.0,2026-06-29
Vinho 0.5L,4.0,2026-06-29
Vinho Branco da casa (copo),1.0,2026-06-29
Vinho Menu,2.0,2026-06-29
Água 0.33L,1.0,2026-06-29
Água 0.5L,14.0,2026-06-29
Água c/gás,18.0,2026-06-29
Arroz de Tamboril,1.0,2026-06-30
BR Ribeiro Santo Encruzado,1.0,2026-06-30
Bacalhau à Lagareiro,1.0,2026-06-30
Bebida Dia,12.0,2026-06-30
Café,8.0,2026-06-30
Coca-Cola,3.0,2026-06-30
Couvert,6.0,2026-06-30
Doce da casa,1.0,2026-06-30
Filetes Peixe Galo,9.0,2026-06-30
Filetes de Polvo,5.5,2026-06-30
Fino,2.0,2026-06-30
Maça Assada,1.0,2026-06-30
Menu 25€,4.0,2026-06-30
Menu Degustação Simples,8.0,2026-06-30
Menu Dia,7.0,2026-06-30
Polvo Ensalsado,1.0,2026-06-30
Prato do dia Carne,10.0,2026-06-30
Prato do dia Peixe,4.0,2026-06-30
Pudim,2.0,2026-06-30
Salada,1.0,2026-06-30
Sopa de Peixe,1.0,2026-06-30
Take Away,3.0,2026-06-30
Taça de Gelado,1.0,2026-06-30
Tostas de Rabo de Boi,1.0,2026-06-30
V Muralhas,1.0,2026-06-30
Vinho 0.5L,2.0,2026-06-30
Vinho Menu,10.0,2026-06-30
Água 0.5L,4.0,2026-06-30
Água Menu,2.0,2026-06-30
Ameijoas à Bulhão Pato,2.0,2026-07-01
Arroz de Polvo,1.0,2026-07-01
Arroz de Rabo de Boi,1.0,2026-07-01
Arroz de Tamboril,1.0,2026-07-01
Arroz dose,1.0,2026-07-01
Azeitonas,2.0,2026-07-01
BR GALHARDINI,2.0,2026-07-01
BR Papa Figos,1.0,2026-07-01
Bacalhau à Brás,2.0,2026-07-01
Bacalhau à Lagareiro,1.0,2026-07-01
Batata dose,1.0,2026-07-01
Bebida Dia,26.0,2026-07-01
Bolinhas Alheira (6 Un.),1.0,2026-07-01
Café,24.0,2026-07-01
Camarao ao alho,1.0,2026-07-01
Camarão da Costa,1.0,2026-07-01
Carne de Porco à Alentejana,2.0,2026-07-01
Cerveja S/Alcool,1.0,2026-07-01
Cesto de Pão,1.0,2026-07-01
Coca-Cola,8.0,2026-07-01
Couvert,13.0,2026-07-01
Coxa de Pato Confitada,1.0,2026-07-01
Doce da casa,6.0,2026-07-01
Dourada/Robalo Grelhado,1.0,2026-07-01
Entrecôte,5.0,2026-07-01
Filetes Peixe Galo,3.0,2026-07-01
Filetes de Polvo,4.0,2026-07-01
Fino,7.0,2026-07-01
Legumes Salteados,1.0,2026-07-01
Magret de Pato,1.0,2026-07-01
Martini,1.0,2026-07-01
Massada de Peixe,2.0,2026-07-01
Maça Assada,3.0,2026-07-01
Melão com Presunto,1.0,2026-07-01
Menu Dia,13.0,2026-07-01
Mouse,2.0,2026-07-01
Ovos Rotos,1.0,2026-07-01
Pica-Pau Terra e Mar,1.0,2026-07-01
Picanha,1.0,2026-07-01
Polvo Ensalsado,1.0,2026-07-01
Polvo à Lagareiro,2.0,2026-07-01
Prato do dia Carne,6.0,2026-07-01
Prato do dia Peixe,20.0,2026-07-01
Pudim,1.0,2026-07-01
Seven Up,1.0,2026-07-01
Sopa de Marisco,1.0,2026-07-01
Take Away,2.0,2026-07-01
Taça de Gelado,1.0,2026-07-01
Tostas de Rabo de Boi,2.0,2026-07-01
V Muralhas,1.0,2026-07-01
Vinho 0.5L,9.0,2026-07-01
Vinho 1L,1.0,2026-07-01
Vinho Menu,2.0,2026-07-01
Vinho do Porto (dose),1.0,2026-07-01
Água 0.5L,4.0,2026-07-01
Água c/gás,11.0,2026-07-01
Ameijoas à Bulhão Pato,1.0,2026-07-02
Arroz de Tamboril,3.0,2026-07-02
BR Valle do Nídeo,3.0,2026-07-02
Bacalhau à Lagareiro,1.0,2026-07-02
Bebida Dia,28.0,2026-07-02
Café,18.0,2026-07-02
Camarao ao alho,1.0,2026-07-02
Camarão da Costa,1.0,2026-07-02
Carne de Porco à Alentejana,1.0,2026-07-02
Cesto de Pão,2.0,2026-07-02
Chá,1.0,2026-07-02
Couvert,11.0,2026-07-02
Doce da casa,4.0,2026-07-02
Dourada/Robalo Grelhado,1.0,2026-07-02
Entrecôte,2.0,2026-07-02
Filetes Peixe Galo,6.0,2026-07-02
Filetes de Polvo,1.0,2026-07-02
Fino,10.0,2026-07-02
Fruta,1.0,2026-07-02
Fruta Tropical,1.0,2026-07-02
Maça Assada,3.0,2026-07-02
Menu Dia,14.0,2026-07-02
Mouse,2.0,2026-07-02
Pera Bêbada,5.0,2026-07-02
Pica-pau,1.0,2026-07-02
Polvo Ensalsado,1.0,2026-07-02
Polvo à Lagareiro,2.0,2026-07-02
Prato do dia Carne,8.0,2026-07-02
Prato do dia Peixe,20.0,2026-07-02
Pudim,2.0,2026-07-02
RS Papa Figos,1.0,2026-07-02
Sangria 1.5L,1.0,2026-07-02
Sopa,1.0,2026-07-02
Sopa de Peixe,2.0,2026-07-02
TT Ribeiro Santo Res,1.0,2026-07-02
V Muralhas,1.0,2026-07-02
Vinho 0.5L,3.0,2026-07-02
Vinho 1L,1.0,2026-07-02
Vinho Tinto da casa (copo),2.0,2026-07-02
Água 0.5L,7.0,2026-07-02
Água c/gás,2.0,2026-07-02
Alheira,1.0,2026-07-03
Arroz de Rabo de Boi,1.0,2026-07-03
Azeitonas,2.0,2026-07-03
BR Monte Peceguinha,2.0,2026-07-03
BR Ribeiro Santo Encruzado,1.0,2026-07-03
Bacalhau à Brás,1.0,2026-07-03
Bacalhau à Lagareiro,2.0,2026-07-03
Batata dose,1.0,2026-07-03
Bebida Dia,8.0,2026-07-03
Bife de Atum,1.0,2026-07-03
Café,10.0,2026-07-03
Carne de Porco à Alentejana,2.0,2026-07-03
Cerveja S/Alcool,1.0,2026-07-03
Compal Néctar,1.0,2026-07-03
Couvert,6.0,2026-07-03
Doce da casa,2.0,2026-07-03
Entrecôte,1.0,2026-07-03
Filetes Peixe Galo,15.5,2026-07-03
Filetes de Polvo,2.5,2026-07-03
Fino,14.0,2026-07-03
Fruta,1.0,2026-07-03
Legumes Salteados,1.0,2026-07-03
Magret de Pato,1.0,2026-07-03
Maça Assada,1.0,2026-07-03
Menu Dia,4.0,2026-07-03
Mini Sagres,5.0,2026-07-03
Mouse,3.0,2026-07-03
Ovos Rotos,1.0,2026-07-03
Pera Bêbada,2.0,2026-07-03
Picanha,1.0,2026-07-03
Prato do dia Peixe,8.0,2026-07-03
Prego,1.0,2026-07-03
RS Papa Figos,1.0,2026-07-03
Salada,1.0,2026-07-03
Sangria 1L,1.0,2026-07-03
Sopa de Marisco,1.0,2026-07-03
Sopa de Peixe,5.0,2026-07-03
TT V.Nídeo Reserva,1.0,2026-07-03
Take Away,2.0,2026-07-03
Taça de Gelado,1.0,2026-07-03
V Muralhas,2.0,2026-07-03
Vinho 0.5L,1.0,2026-07-03
Água 0.5L,5.0,2026-07-03
Alheira,1.0,2026-07-04
Ameijoas à Bulhão Pato,4.0,2026-07-04
Arroz de Polvo,3.0,2026-07-04
Arroz de Rabo de Boi,1.0,2026-07-04
Azeitonas,1.0,2026-07-04
BR Ribeiro Santo Encruzado,4.0,2026-07-04
BR Titular Colheita,1.0,2026-07-04
Bacalhau à Brás,1.0,2026-07-04
Bacalhau à Lagareiro,1.0,2026-07-04
Bebida Dia,20.0,2026-07-04
Beirão,1.0,2026-07-04
Bife Lombo,1.0,2026-07-04
Bife de Atum,1.0,2026-07-04
Bolinhas de Alheira (3 Un.),2.0,2026-07-04
Buldog,1.0,2026-07-04
Café,26.0,2026-07-04
Camarão da Costa,1.0,2026-07-04
Coca-Cola,9.0,2026-07-04
Couvert,16.0,2026-07-04
Coxa de Pato Confitada,3.0,2026-07-04
Doce da casa,5.0,2026-07-04
Entrecôte,3.0,2026-07-04
Filetes Peixe Galo,21.0,2026-07-04
Filetes de Polvo,8.0,2026-07-04
Fino,23.0,2026-07-04
Fruta,2.0,2026-07-04
Ice Tea,2.0,2026-07-04
Menu Dia,10.0,2026-07-04
Mouse,4.0,2026-07-04
Pera Bêbada,2.0,2026-07-04
Picanha,4.0,2026-07-04
Polvo Ensalsado,1.0,2026-07-04
Polvo à Lagareiro,1.0,2026-07-04
Prato do dia Peixe,20.0,2026-07-04
Pudim,5.0,2026-07-04
Salada,2.0,2026-07-04
Sopa,1.0,2026-07-04
TT Dona Matilde Res,2.0,2026-07-04
TT S. Domingos Reserva,1.0,2026-07-04
TT V.Nídeo Reserva,1.0,2026-07-04
TT Vinha Grande,1.0,2026-07-04
Take Away,4.0,2026-07-04
Taça de Gelado,1.0,2026-07-04
Vinho 0.5L,5.0,2026-07-04
Vinho 1L,1.0,2026-07-04
Vinho Branco da casa (copo),3.0,2026-07-04
Vinho Tinto da casa (copo),1.0,2026-07-04
Água 0.5L,14.0,2026-07-04
Água c/gás,2.0,2026-07-04
Arroz de Polvo,1.0,2026-07-06
Arroz de Rabo de Boi,2.0,2026-07-06
Bacalhau à Lagareiro,1.0,2026-07-06
Bebida Dia,24.0,2026-07-06
Bife de Atum,1.0,2026-07-06
Café,13.0,2026-07-06
Cerveja S/Alcool,1.0,2026-07-06
Cesto de Pão,1.0,2026-07-06
Coca-Cola,2.0,2026-07-06
Couvert,8.0,2026-07-06
Doce da casa,1.0,2026-07-06
Entrecôte,1.0,2026-07-06
Filetes Peixe Galo,8.5,2026-07-06
Filetes de Polvo,5.5,2026-07-06
Fino,5.0,2026-07-06
Fruta,1.0,2026-07-06
Menu Dia,12.0,2026-07-06
Mini Sagres,3.0,2026-07-06
Pera Bêbada,1.0,2026-07-06
Polvo à Lagareiro,1.0,2026-07-06
Prato do dia Carne,12.0,2026-07-06
Prato do dia Peixe,12.0,2026-07-06
Prego,1.0,2026-07-06
Queijo Couvert,1.0,2026-07-06
RS Papa Figos,1.0,2026-07-06
Sopa de Marisco,1.0,2026-07-06
Sopa de Peixe,1.0,2026-07-06
Take Away,3.0,2026-07-06
V Regueiro,1.0,2026-07-06
Vinho 0.5L,3.0,2026-07-06
Vinho 1L,1.0,2026-07-06
Vinho Branco da casa (copo),1.0,2026-07-06
Água 0.5L,6.0,2026-07-06
Água c/gás,2.0,2026-07-06
Ameijoas à Bulhão Pato,4.0,2026-07-07
Arroz de Polvo,1.0,2026-07-07
BR Luis Pato Vinhas Velhas,1.0,2026-07-07
BR Monte Peceguinha,2.0,2026-07-07
BR Piano Moscatel Galego,1.0,2026-07-07
BR Planalto,1.0,2026-07-07
BR Titular Colheita,2.0,2026-07-07
Batata dose,1.0,2026-07-07
Bebida Dia,28.0,2026-07-07
Bife de Atum,1.0,2026-07-07
Café,14.0,2026-07-07
Camarao ao alho,1.0,2026-07-07
Cesto de Pão,1.0,2026-07-07
Couvert,9.0,2026-07-07
Doce da casa,6.0,2026-07-07
Entrecôte,2.0,2026-07-07
Filetes Peixe Galo,35.5,2026-07-07
Filetes de Polvo,2.0,2026-07-07
Fino,15.0,2026-07-07
Ice Tea,1.0,2026-07-07
Magret de Pato,1.0,2026-07-07
Maça Assada,2.0,2026-07-07
Menu 25€,5.0,2026-07-07
"Menu 25€,Menu Degustação Simples,Vinho Menu",6.0,2026-07-07
Menu Degustação Simples,12.0,2026-07-07
Menu Dia,14.0,2026-07-07
Mouse,3.0,2026-07-07
Pera Bêbada,1.0,2026-07-07
Picanha,1.0,2026-07-07
Prato do dia Carne,6.0,2026-07-07
Prato do dia Peixe,22.0,2026-07-07
Pudim,1.0,2026-07-07
RS Papa Figos,1.0,2026-07-07
Salada,2.0,2026-07-07
Sopa,2.0,2026-07-07
Take Away,3.0,2026-07-07
V Muralhas,2.0,2026-07-07
Vinho 0.5L,3.0,2026-07-07
Vinho Branco da casa (copo),2.0,2026-07-07
Vinho Menu,14.0,2026-07-07
Água 0.5L,9.0,2026-07-07
Ameijoas à Bulhão Pato,1.0,2026-07-08
Arroz Conquilhas,2.0,2026-07-08
Arroz de Polvo,1.0,2026-07-08
Arroz de Rabo de Boi,2.0,2026-07-08
Arroz de Tamboril,1.0,2026-07-08
BR Luis Pato Maria Gomes,2.0,2026-07-08
BR Valle do Nídeo,1.0,2026-07-08
Bacalhau à Brás,3.0,2026-07-08
Bacalhau à Lagareiro,2.0,2026-07-08
Bebida Dia,6.0,2026-07-08
Bolinhas Alheira (6 Un.),1.0,2026-07-08
Brandy Croft,1.0,2026-07-08
Buldog,1.0,2026-07-08
Café,25.0,2026-07-08
Caldo Verde,2.0,2026-07-08
Carne de Porco à Alentejana,1.0,2026-07-08
Cesto de Pão,1.0,2026-07-08
Coca-Cola,6.0,2026-07-08
Compal Néctar,2.0,2026-07-08
Couvert,15.0,2026-07-08
Doce da casa,3.0,2026-07-08
Entrecôte,3.0,2026-07-08
Filetes Peixe Galo,11.5,2026-07-08
Filetes de Polvo,7.0,2026-07-08
Fino,6.0,2026-07-08
Ice Tea,2.0,2026-07-08
Legumes Salteados,1.0,2026-07-08
Maça Assada,4.0,2026-07-08
Menu Dia,3.0,2026-07-08
Mouse,1.0,2026-07-08
Omelete Camarão,3.0,2026-07-08
Ovos Rotos,1.0,2026-07-08
Pera Bêbada,2.0,2026-07-08
Picanha,1.0,2026-07-08
Polvo à Lagareiro,2.0,2026-07-08
Posta,1.0,2026-07-08
Prato do dia Carne,4.0,2026-07-08
Prato do dia Peixe,2.0,2026-07-08
Pudim,1.0,2026-07-08
Sangria 1.5L,1.0,2026-07-08
Sopa,1.0,2026-07-08
Sopa de Peixe,5.0,2026-07-08
TT Burmester meia gr.,1.0,2026-07-08
TT V.Nídeo Reserva,1.0,2026-07-08
Tostas de Rabo de Boi,4.0,2026-07-08
Vinho 0.5L,7.0,2026-07-08
Vinho Branco da casa (copo),3.0,2026-07-08
Vinho Menu,1.0,2026-07-08
Vinho Tinto da casa (copo),2.0,2026-07-08
Água 0.5L,12.0,2026-07-08
Água c/gás,3.0,2026-07-08
Arroz de Tamboril,1.0,2026-07-09
Azeitonas,1.0,2026-07-09
BR Monte Peceguinha,1.0,2026-07-09
BR Titular Reserva,2.0,2026-07-09
BR Valle do Nídeo,1.0,2026-07-09
Bacalhau à Brás,1.0,2026-07-09
Bacalhau à Lagareiro,1.0,2026-07-09
Bebida Dia,8.0,2026-07-09
Bife Lombo,1.0,2026-07-09
Bolinhas de Alheira (3 Un.),1.0,2026-07-09
Café,8.0,2026-07-09
Camarao ao alho,1.0,2026-07-09
Coca-Cola,3.0,2026-07-09
Couvert,9.0,2026-07-09
Coxa de Pato Confitada,1.0,2026-07-09
Doce da casa,3.0,2026-07-09
Dourada/Robalo Grelhado,1.0,2026-07-09
Entrecôte,2.0,2026-07-09
Filetes Peixe Galo,13.0,2026-07-09
Filetes de Polvo,3.0,2026-07-09
Fino,4.0,2026-07-09
Fruta,1.0,2026-07-09
Ice Tea,1.0,2026-07-09
Menu Dia,5.0,2026-07-09
Mouse,3.0,2026-07-09
Omelete Camarão,1.0,2026-07-09
Ovos Rotos,1.0,2026-07-09
Picanha,2.0,2026-07-09
Prato do dia Carne,6.0,2026-07-09
Prato do dia Peixe,4.0,2026-07-09
Prego,1.0,2026-07-09
Sangria Espumante 1.5L,1.0,2026-07-09
V Regueiro,1.0,2026-07-09
Vinho 0.5L,1.0,2026-07-09
Água 0.5L,8.0,2026-07-09
Água Menu,2.0,2026-07-09
Água c/gás,1.0,2026-07-09
Alheira,1.0,2026-07-10
Arroz de Polvo,1.0,2026-07-10
BR Volupia,2.0,2026-07-10
Bacalhau à Brás,4.0,2026-07-10
Bebida Dia,10.0,2026-07-10
Bife Lombo,1.0,2026-07-10
Bife de Atum,3.0,2026-07-10
Bolinhas Alheira (6 Un.),6.0,2026-07-10
Bolinhas de Alheira (3 Un.),1.0,2026-07-10
Café,15.0,2026-07-10
Camarao ao alho,1.0,2026-07-10
Carne de Porco à Alentejana,6.0,2026-07-10
Cerveja S/Alcool,1.0,2026-07-10
Cesto de Pão,4.0,2026-07-10
Chouriço Assado,2.0,2026-07-10
Coca-Cola,2.0,2026-07-10
Couvert,13.0,2026-07-10
Doce da casa,8.0,2026-07-10
Dourada/Robalo Grelhado,1.0,2026-07-10
Filetes Peixe Galo,5.5,2026-07-10
Filetes de Polvo,5.0,2026-07-10
Fino,5.0,2026-07-10
Maça Assada,3.0,2026-07-10
Melão com Presunto,1.0,2026-07-10
Menu Dia,5.0,2026-07-10
Mouse,4.0,2026-07-10
Ovos Rotos,1.0,2026-07-10
Posta,6.0,2026-07-10
Prato do dia Peixe,10.0,2026-07-10
Prego,2.0,2026-07-10
Pudim,3.0,2026-07-10
Queijo Couvert,2.0,2026-07-10
Seven Up,2.0,2026-07-10
Sopa,1.0,2026-07-10
Take Away,1.0,2026-07-10
Tostas de Rabo de Boi,1.0,2026-07-10
Vegetariano,2.0,2026-07-10
Vinho 0.5L,5.0,2026-07-10
Vinho 1L,1.0,2026-07-10
Vinho Branco da casa (copo),2.0,2026-07-10
Vinho Menu,2.0,2026-07-10
Vinho Tinto da casa (copo),8.0,2026-07-10
Água 0.33L,2.0,2026-07-10
Água 0.5L,13.0,2026-07-10
Água c/gás,1.0,2026-07-10
Ameijoas à Bulhão Pato,5.0,2026-07-11
Arroz de Rabo de Boi,3.0,2026-07-11
Azeitonas,1.0,2026-07-11
BR Papa Figos,1.0,2026-07-11
BR Ribeiro Santo Colheita,1.0,2026-07-11
BR Ribeiro Santo Encruzado,4.0,2026-07-11
BR Vinha Grande,1.0,2026-07-11
Bacalhau à Brás,2.0,2026-07-11
Bebida Dia,16.0,2026-07-11
Bife Lombo,2.0,2026-07-11
Bife de Atum,3.0,2026-07-11
Bolinhas de Alheira (3 Un.),1.0,2026-07-11
Café,28.0,2026-07-11
Caldo Verde,3.0,2026-07-11
Carne de Porco à Alentejana,2.0,2026-07-11
Cesto de Pão,3.0,2026-07-11
Coca-Cola,3.0,2026-07-11
Couvert,9.0,2026-07-11
Doce da casa,4.0,2026-07-11
Dourada/Robalo Grelhado,2.0,2026-07-11
Entrecôte,4.0,2026-07-11
Filetes Peixe Galo,36.0,2026-07-11
Filetes de Polvo,4.5,2026-07-11
Fino,13.0,2026-07-11
Fruta Tropical,1.0,2026-07-11
Ice Tea,2.0,2026-07-11
Massada de Peixe,1.0,2026-07-11
Maça Assada,3.0,2026-07-11
Menu Dia,8.0,2026-07-11
Mini Sagres,16.0,2026-07-11
Mouse,1.0,2026-07-11
Pera Bêbada,2.0,2026-07-11
Pica-pau,2.0,2026-07-11
Posta,1.0,2026-07-11
Prato do dia Carne,6.0,2026-07-11
Prato do dia Peixe,10.0,2026-07-11
Pudim,1.0,2026-07-11
Sopa,1.0,2026-07-11
Sopa de Marisco,1.0,2026-07-11
Sopa de Peixe,2.0,2026-07-11
TT Monte Peceguinha,3.0,2026-07-11
Take Away,2.0,2026-07-11
Tostas de Rabo de Boi,8.0,2026-07-11
V Muralhas,1.0,2026-07-11
Vinho 0.5L,1.0,2026-07-11
Vinho 1L,2.0,2026-07-11
Vinho Branco da casa (copo),2.0,2026-07-11
Vinho Menu,1.0,2026-07-11
Vinho Tinto da casa (copo),3.0,2026-07-11
Água 0.33L,1.0,2026-07-11
Água 0.5L,14.0,2026-07-11
Água c/gás,1.0,2026-07-11
Fino,4.0,2026-07-12
Ameijoas à Bulhão Pato,2.0,2026-07-13
Arroz de Rabo de Boi,1.0,2026-07-13
Arroz dose,1.0,2026-07-13
Azeitonas,1.0,2026-07-13
BR Monte Peceguinha,1.0,2026-07-13
BR Ribeiro Santo Encruzado,1.0,2026-07-13
BR V. Nídeo SauvignonBlanc,1.0,2026-07-13
Bacalhau à Brás,6.0,2026-07-13
Bebida Dia,32.0,2026-07-13
Bolinhas Alheira (6 Un.),1.0,2026-07-13
Bolinhas de Alheira (3 Un.),1.0,2026-07-13
Café,21.0,2026-07-13
Caldo Verde,5.0,2026-07-13
Camarão da Costa,1.0,2026-07-13
Carne de Porco à Alentejana,3.0,2026-07-13
Cesto de Pão,1.0,2026-07-13
Chouriço Assado,1.0,2026-07-13
Coca-Cola,2.0,2026-07-13
Couvert,13.0,2026-07-13
Doce da casa,1.0,2026-07-13
Dourada/Robalo Grelhado,2.0,2026-07-13
Filetes Peixe Galo,3.0,2026-07-13
Filetes de Polvo,1.0,2026-07-13
Fino,2.0,2026-07-13
Ice Tea,2.0,2026-07-13
Melão com Presunto,1.0,2026-07-13
Menu Dia,16.0,2026-07-13
Mini Sagres,1.0,2026-07-13
Mouse,4.0,2026-07-13
Omelete Camarão,1.0,2026-07-13
Ovos Rotos,3.0,2026-07-13
Pera Bêbada,2.0,2026-07-13
Pica-pau,2.0,2026-07-13
Picanha,4.0,2026-07-13
Polvo à Lagareiro,1.0,2026-07-13
Prato do dia Carne,8.0,2026-07-13
Prato do dia Peixe,24.0,2026-07-13
Pudim,3.0,2026-07-13
Queijo Couvert,1.0,2026-07-13
Salada,1.0,2026-07-13
Sopa de Peixe,2.0,2026-07-13
Take Away,4.0,2026-07-13
Tostas de Rabo de Boi,1.0,2026-07-13
Vinho 0.5L,4.0,2026-07-13
Vinho 1L,1.0,2026-07-13
Vinho Branco da casa (copo),2.0,2026-07-13
Vinho Menu,2.0,2026-07-13
Vinho Tinto da casa (copo),3.0,2026-07-13
Água 0.5L,16.0,2026-07-13
Água c/gás,3.0,2026-07-13
Ameijoas à Bulhão Pato,2.0,2026-07-14
Arroz de Lingueirão,1.0,2026-07-14
Arroz de Polvo,1.0,2026-07-14
Azeitonas,3.0,2026-07-14
BR Duvalley Reserva,1.0,2026-07-14
BR Monte Peceguinha,2.0,2026-07-14
Bacalhau à Brás,1.0,2026-07-14
Bebida Dia,8.0,2026-07-14
Bife Lombo,1.0,2026-07-14
Bife de Atum,1.0,2026-07-14
Bolinhas Alheira (6 Un.),1.0,2026-07-14
Café,14.0,2026-07-14
Camarao ao alho,1.0,2026-07-14
Carne de Porco à Alentejana,4.0,2026-07-14
Cesto de Pão,4.0,2026-07-14
Coca-Cola,4.0,2026-07-14
Couvert,7.0,2026-07-14
Coxa de Pato Confitada,1.0,2026-07-14
Doce da casa,3.0,2026-07-14
Entrecôte,1.0,2026-07-14
Filetes Peixe Galo,7.0,2026-07-14
Filetes de Polvo,2.0,2026-07-14
Fino,9.0,2026-07-14
Ice Tea,7.0,2026-07-14
Magret de Pato,1.0,2026-07-14
Maça Assada,1.0,2026-07-14
Melão com Presunto,2.0,2026-07-14
Menu 25€,6.0,2026-07-14
Menu Degustação Simples,12.0,2026-07-14
Menu Dia,4.0,2026-07-14
Moscatel Roxo,4.0,2026-07-14
Pera Bêbada,1.0,2026-07-14
Pica-pau,1.0,2026-07-14
Picanha,8.0,2026-07-14
Polvo à Lagareiro,1.0,2026-07-14
Prato do dia Carne,4.0,2026-07-14
Prato do dia Peixe,4.0,2026-07-14
Salada,2.0,2026-07-14
Sopa de Peixe,3.0,2026-07-14
Taça de Gelado,1.0,2026-07-14
Tostas de Rabo de Boi,6.0,2026-07-14
Vinho 0.5L,2.0,2026-07-14
Vinho 1L,2.0,2026-07-14
Vinho Branco da casa (copo),1.0,2026-07-14
Vinho Menu,12.0,2026-07-14
Vinho Tinto da casa (copo),1.0,2026-07-14
Água 0.5L,24.0,2026-07-14
Água c/gás,4.0,2026-07-14
Arroz de Rabo de Boi,2.0,2026-07-15
BR Luis Pato Maria Gomes,1.0,2026-07-15
Bacalhau à Brás,3.0,2026-07-15
Bacalhau à Lagareiro,1.0,2026-07-15
Batata dose,1.0,2026-07-15
Bebida Dia,18.0,2026-07-15
Café,13.0,2026-07-15
Couvert,8.0,2026-07-15
Doce da casa,2.0,2026-07-15
Filetes Peixe Galo,15.0,2026-07-15
Fino,2.0,2026-07-15
Fruta Tropical,1.0,2026-07-15
Maça Assada,1.0,2026-07-15
Menu Dia,9.0,2026-07-15
Pera Bêbada,3.0,2026-07-15
Polvo à Lagareiro,1.0,2026-07-15
Prato do dia Carne,8.0,2026-07-15
Prato do dia Peixe,10.0,2026-07-15
Pudim,3.0,2026-07-15
Sangria 1.5L,1.0,2026-07-15
Sopa,1.0,2026-07-15
TT Esteva,1.0,2026-07-15
Take Away,2.0,2026-07-15
Tostas de Rabo de Boi,2.0,2026-07-15
Vinho 0.5L,3.0,2026-07-15
Vinho Branco da casa (copo),2.0,2026-07-15
Vinho Tinto da casa (copo),1.0,2026-07-15
Água 0.5L,8.0,2026-07-15
Ameijoas à Bulhão Pato,2.0,2026-07-16
Arroz Doce,2.0,2026-07-16
Arroz de Polvo,2.0,2026-07-16
Arroz de Rabo de Boi,1.0,2026-07-16
BR Luis Pato Vinhas Velhas,1.0,2026-07-16
BR Monte Peceguinha,1.0,2026-07-16
BR Papa Figos,1.0,2026-07-16
BR Qta Portal Moscatel,1.0,2026-07-16
BR Ribeiro Santo Encruzado,2.0,2026-07-16
BR Valle do Nídeo,1.0,2026-07-16
Bebida Dia,20.0,2026-07-16
Bife de Atum,1.0,2026-07-16
Black Pig,1.0,2026-07-16
Café,5.0,2026-07-16
Camarao ao alho,2.0,2026-07-16
Carne de Porco à Alentejana,2.0,2026-07-16
Cesto de Pão,4.0,2026-07-16
Chouriço Assado,1.0,2026-07-16
Coca-Cola,6.0,2026-07-16
Couvert,6.0,2026-07-16
Doce da casa,1.0,2026-07-16
Entrecôte,1.0,2026-07-16
Filetes Peixe Galo,11.5,2026-07-16
Filetes de Polvo,2.5,2026-07-16
Fino,2.0,2026-07-16
Fruta Tropical,2.0,2026-07-16
Ice Tea,1.0,2026-07-16
Maça Assada,2.0,2026-07-16
Menu Dia,10.0,2026-07-16
Pica-pau,1.0,2026-07-16
Polvo Ensalsado,1.0,2026-07-16
Polvo à Lagareiro,1.0,2026-07-16
Prato do dia Carne,4.0,2026-07-16
Prato do dia Peixe,16.0,2026-07-16
Prego,1.0,2026-07-16
Pudim,1.0,2026-07-16
Salada,1.0,2026-07-16
Sandwich Club,1.0,2026-07-16
Seven Up,1.0,2026-07-16
Sopa de Peixe,1.0,2026-07-16
TT Galhardini,1.0,2026-07-16
Take Away,1.0,2026-07-16
Vegetariano,2.0,2026-07-16
Vinho 0.5L,1.0,2026-07-16
Vinho Branco da casa (copo),2.0,2026-07-16
Vinho Menu,1.0,2026-07-16
Água 0.5L,8.0,2026-07-16
Água c/gás,2.0,2026-07-16
Ameijoas à Bulhão Pato,2.0,2026-07-17
Arroz Doce,3.0,2026-07-17
Arroz de Polvo,1.0,2026-07-17
Arroz de Rabo de Boi,1.0,2026-07-17
Arroz dose,1.0,2026-07-17
BR Ribeiro Santo Encruzado,2.0,2026-07-17
Bacalhau à Brás,3.0,2026-07-17
Bebida Dia,26.0,2026-07-17
Bife de Atum,3.0,2026-07-17
Bolinhas Alheira (6 Un.),3.0,2026-07-17
Bolinhas de Alheira (3 Un.),1.0,2026-07-17
Café,20.0,2026-07-17
Caldo Verde,2.0,2026-07-17
Camarao ao alho,1.0,2026-07-17
Camarão da Costa,1.0,2026-07-17
Carne de Porco à Alentejana,4.0,2026-07-17
Cesto de Pão,1.0,2026-07-17
Chouriço Assado,3.0,2026-07-17
Coca-Cola,2.0,2026-07-17
Couvert,11.0,2026-07-17
Doce da casa,6.0,2026-07-17
Dourada/Robalo Grelhado,2.0,2026-07-17
E Quinta Ortigão,1.0,2026-07-17
ES S. Domingos Extra Reserva,1.0,2026-07-17
Entrecôte,1.0,2026-07-17
Feijão Preto,1.0,2026-07-17
Filetes Peixe Galo,14.0,2026-07-17
Filetes de Polvo,1.0,2026-07-17
Fino,4.0,2026-07-17
Fruta,1.0,2026-07-17
Fruta Tropical,3.0,2026-07-17
Ice Tea,4.0,2026-07-17
Maça Assada,4.0,2026-07-17
Melão com Presunto,1.0,2026-07-17
Menu Dia,25.0,2026-07-17
Mini Sagres,7.0,2026-07-17
Mouse,4.0,2026-07-17
Ovos Rotos,2.0,2026-07-17
Pera Bêbada,2.0,2026-07-17
Pica-pau,1.0,2026-07-17
Polvo Ensalsado,2.0,2026-07-17
Polvo à Lagareiro,1.0,2026-07-17
Prato do dia Carne,10.0,2026-07-17
Prato do dia Peixe,16.0,2026-07-17
Prego,1.0,2026-07-17
Pudim,4.0,2026-07-17
Salada,2.0,2026-07-17
Sangria 1.5L,3.0,2026-07-17
Sangria Espumante 1.5L,1.0,2026-07-17
Seven Up,1.0,2026-07-17
Sopa de Marisco,1.0,2026-07-17
Sopa de Peixe,6.0,2026-07-17
TT Papa Figos,1.0,2026-07-17
Take Away,5.0,2026-07-17
Tostas de Rabo de Boi,1.0,2026-07-17
Vegetariano,1.0,2026-07-17
Vinho 0.5L,4.0,2026-07-17
Vinho Branco da casa (copo),3.0,2026-07-17
Vinho Menu,3.0,2026-07-17
Água 0.5L,9.0,2026-07-17
Água c/gás,9.0,2026-07-17
Ameijoas à Bulhão Pato,3.0,2026-07-18
Arroz Doce,3.0,2026-07-18
Arroz de Polvo,1.0,2026-07-18
Arroz de Rabo de Boi,1.0,2026-07-18
BR Luis Pato Maria Gomes,2.0,2026-07-18
BR Piano Moscatel Galego,1.0,2026-07-18
BR Planalto,3.0,2026-07-18
BR Qta Portal Moscatel,1.0,2026-07-18
BR Ribeiro Santo Colheita,1.0,2026-07-18
BR Vinha Grande,2.0,2026-07-18
Bacalhau à Brás,5.0,2026-07-18
Batata dose,1.0,2026-07-18
Bebida Dia,22.0,2026-07-18
Bife Lombo,2.0,2026-07-18
Bife de Atum,3.0,2026-07-18
Bolinhas de Alheira (3 Un.),1.0,2026-07-18
Café,49.0,2026-07-18
Caldo Verde,1.0,2026-07-18
Camarão da Costa,2.0,2026-07-18
Carne de Porco à Alentejana,3.0,2026-07-18
Cerveja S/Alcool,3.0,2026-07-18
Cesto de Pão,5.0,2026-07-18
Coca-Cola,5.0,2026-07-18
Couvert,16.0,2026-07-18
Coxa de Pato Confitada,1.0,2026-07-18
Doce da casa,12.0,2026-07-18
E S.Domingos,2.0,2026-07-18
Entrecôte,3.0,2026-07-18
Filetes Peixe Galo,39.0,2026-07-18
Filetes de Polvo,16.5,2026-07-18
Fino,41.0,2026-07-18
Fruta,1.0,2026-07-18
Ice Tea,3.0,2026-07-18
Magret de Pato,2.0,2026-07-18
Martini Bianco,1.0,2026-07-18
Maça Assada,4.0,2026-07-18
Melão com Presunto,1.0,2026-07-18
Menu Dia,11.0,2026-07-18
Mini Sagres,11.0,2026-07-18
Mouse,5.0,2026-07-18
Omelete Camarão,1.0,2026-07-18
Ovos Rotos,2.0,2026-07-18
Pera Bêbada,4.0,2026-07-18
Picanha,4.0,2026-07-18
Polvo Ensalsado,1.0,2026-07-18
Polvo à Lagareiro,2.0,2026-07-18
Prato do dia Carne,10.0,2026-07-18
Prato do dia Peixe,12.0,2026-07-18
Pudim,4.0,2026-07-18
Queijo Couvert,2.0,2026-07-18
RS Papa Figos,1.0,2026-07-18
Salada,1.0,2026-07-18
Sopa,1.0,2026-07-18
Sopa de Marisco,1.0,2026-07-18
TT Dona Matilde,2.0,2026-07-18
TT V.Nídeo Reserva,1.0,2026-07-18
Take Away,5.0,2026-07-18
Taça de Gelado,3.0,2026-07-18
Tostas de Rabo de Boi,4.0,2026-07-18
Vinho 0.5L,4.0,2026-07-18
Vinho Branco da casa (copo),4.0,2026-07-18
Vinho Tinto da casa (copo),1.0,2026-07-18
Água 0.5L,21.0,2026-07-18
Arroz de Polvo,6.0,2026-07-20
Arroz de Rabo de Boi,2.0,2026-07-20
Arroz de Tamboril,2.0,2026-07-20
BR Monte Peceguinha,1.0,2026-07-20
BR Vinha Grande,1.0,2026-07-20
Bacalhau à Brás,1.0,2026-07-20
Bacalhau à Lagareiro,3.0,2026-07-20
Batata dose,1.0,2026-07-20
Bebida Dia,32.0,2026-07-20
Bife Lombo,1.0,2026-07-20
Bolinhas Alheira (6 Un.),2.0,2026-07-20
Bolinhas de Alheira (3 Un.),1.0,2026-07-20
Café,29.0,2026-07-20
Caldo Verde,2.0,2026-07-20
Camarao ao alho,1.0,2026-07-20
Camarão costa (Peq.),1.0,2026-07-20
Carne de Porco à Alentejana,4.0,2026-07-20
Cesto de Pão,1.0,2026-07-20
Coca-Cola,5.0,2026-07-20
Couvert,13.0,2026-07-20
Doce da casa,4.0,2026-07-20
Entrecôte,3.0,2026-07-20
Filetes Peixe Galo,8.0,2026-07-20
Filetes de Polvo,2.0,2026-07-20
Fino,10.0,2026-07-20
Fruta,2.0,2026-07-20
Fruta Tropical,1.0,2026-07-20
Ice Tea,7.0,2026-07-20
Manteiga,2.0,2026-07-20
Menu Dia,16.0,2026-07-20
Mouse,2.0,2026-07-20
Pera Bêbada,1.0,2026-07-20
Pica-Pau Terra e Mar,1.0,2026-07-20
Picanha,2.0,2026-07-20
Polvo à Lagareiro,2.0,2026-07-20
Prato do dia Carne,4.0,2026-07-20
Prato do dia Peixe,28.0,2026-07-20
Prego,1.0,2026-07-20
Pudim,5.0,2026-07-20
Salada,2.0,2026-07-20
Salada de Frango,1.0,2026-07-20
Sopa,3.0,2026-07-20
Sopa de Peixe,2.0,2026-07-20
TT V.Nídeo Reserva,1.0,2026-07-20
Take Away,3.0,2026-07-20
Taça de Gelado,1.0,2026-07-20
Tostas de Rabo de Boi,3.0,2026-07-20
Vinho 0.5L,2.0,2026-07-20
Vinho 1L,3.0,2026-07-20
Vinho Menu,2.0,2026-07-20
Água 0.5L,17.0,2026-07-20
Água c/gás,4.0,2026-07-20
Ameijoas à Bulhão Pato,3.0,2026-07-21
Arroz dose,1.0,2026-07-21
Azeitonas,1.0,2026-07-21
BR Papa Figos,1.0,2026-07-21
BR Ribeiro Santo Encruzado,3.0,2026-07-21
Bacalhau à Brás,1.0,2026-07-21
Bebida Dia,32.0,2026-07-21
Bife Lombo,2.0,2026-07-21
Bife de Atum,1.0,2026-07-21
Bolinhas de Alheira (3 Un.),1.0,2026-07-21
Café,17.0,2026-07-21
Caldo Verde,1.0,2026-07-21
Camarao ao alho,1.0,2026-07-21
Carne de Porco à Alentejana,1.0,2026-07-21
Cesto de Pão,3.0,2026-07-21
Coca-Cola,2.0,2026-07-21
Compal Néctar,1.0,2026-07-21
Couvert,2.0,2026-07-21
Delicia de Chocolate,1.0,2026-07-21
Doce da casa,4.0,2026-07-21
Dourada/Robalo Grelhado,1.0,2026-07-21
E S.Domingos,1.0,2026-07-21
Entrecôte,2.0,2026-07-21
Filetes Peixe Galo,7.0,2026-07-21
Filetes de Polvo,2.0,2026-07-21
Fino,9.0,2026-07-21
Fruta,1.0,2026-07-21
Ice Tea,3.0,2026-07-21
Magret de Pato,1.0,2026-07-21
Martini,3.0,2026-07-21
Maça Assada,2.0,2026-07-21
Menu 25€,6.0,2026-07-21
Menu Degustação Simples,12.0,2026-07-21
Menu Dia,16.0,2026-07-21
Mouse,1.0,2026-07-21
Pera Bêbada,2.0,2026-07-21
Pica-Pau Terra e Mar,1.0,2026-07-21
Picanha,2.0,2026-07-21
Polvo Ensalsado,1.0,2026-07-21
Polvo à Lagareiro,7.0,2026-07-21
Prato do dia Carne,2.0,2026-07-21
Prato do dia Peixe,30.0,2026-07-21
Pudim,2.0,2026-07-21
Queijo Couvert,1.0,2026-07-21
Seven Up,1.0,2026-07-21
Sopa de Peixe,4.0,2026-07-21
Take Away,2.0,2026-07-21
Tostas de Rabo de Boi,3.0,2026-07-21
Vegetariano,1.0,2026-07-21
Vinho Branco da casa (copo),2.0,2026-07-21
Vinho Menu,18.0,2026-07-21
Vinho Tinto da casa (copo),3.0,2026-07-21
Água 0.33L,1.0,2026-07-21
Água 0.5L,13.0,2026-07-21
Água c/gás,3.0,2026-07-21
Arroz de Marisco 2Pax,1.0,2026-07-22
Arroz de Polvo,2.0,2026-07-22
Arroz de Rabo de Boi,1.0,2026-07-22
Arroz de Tamboril,1.0,2026-07-22
BR Duvalley Reserva,1.0,2026-07-22
BR Valle do Nídeo,1.0,2026-07-22
BR Volupia,1.0,2026-07-22
Bebida Dia,28.0,2026-07-22
Bife de Atum,1.0,2026-07-22
Café,13.0,2026-07-22
Camarão da Costa,2.0,2026-07-22
Cesto de Pão,3.0,2026-07-22
Coca-Cola,1.0,2026-07-22
Couvert,4.0,2026-07-22
Delicia de Chocolate,5.0,2026-07-22
Doce da casa,2.0,2026-07-22
Entrecôte,3.0,2026-07-22
Filetes Peixe Galo,5.0,2026-07-22
Filetes de Polvo,2.0,2026-07-22
Fino,7.0,2026-07-22
Manteiga,4.0,2026-07-22
Maça Assada,1.0,2026-07-22
Menu Dia,16.0,2026-07-22
Mouse,3.0,2026-07-22
Ovo estrelado,5.0,2026-07-22
Pera Bêbada,1.0,2026-07-22
Pica-pau,2.0,2026-07-22
Polvo Ensalsado,1.0,2026-07-22
Prato do dia Carne,10.0,2026-07-22
Prato do dia Peixe,22.0,2026-07-22
Salada,1.0,2026-07-22
Seven Up,2.0,2026-07-22
Sopa de Peixe,2.0,2026-07-22
TT Burmester meia gr.,1.0,2026-07-22
TT Monte Peceguinha,1.0,2026-07-22
Take Away,1.0,2026-07-22
Vinho 1L,1.0,2026-07-22
Vinho Branco da casa (copo),2.0,2026-07-22
Vinho Menu,2.0,2026-07-22
Água 0.5L,10.0,2026-07-22
Água Menu,4.0,2026-07-22
Água c/gás,1.0,2026-07-22
Ameijoas à Bulhão Pato,5.0,2026-07-23
Arroz de Rabo de Boi,2.0,2026-07-23
Arroz de Tamboril,1.0,2026-07-23
BR Burmester meia gr.,1.0,2026-07-23
BR Ribeiro Santo Encruzado,3.0,2026-07-23
Bacalhau à Brás,1.0,2026-07-23
Bacalhau à Lagareiro,1.0,2026-07-23
Bebida Dia,18.0,2026-07-23
Bife Lombo,1.0,2026-07-23
Bolinhas Alheira (6 Un.),1.0,2026-07-23
Bolinhas de Alheira (3 Un.),1.0,2026-07-23
Café,18.0,2026-07-23
Caldo Verde,1.0,2026-07-23
Camarao ao alho,2.0,2026-07-23
Cesto de Pão,3.0,2026-07-23
Chouriço Assado,2.0,2026-07-23
Coca-Cola,3.0,2026-07-23
Compal Néctar,1.0,2026-07-23
Couvert,6.0,2026-07-23
Delicia de Chocolate,1.0,2026-07-23
Doce da casa,3.0,2026-07-23
Dourada/Robalo Grelhado,2.0,2026-07-23
Entrecôte,2.0,2026-07-23
Filetes Peixe Galo,6.0,2026-07-23
Filetes de Polvo,5.0,2026-07-23
Fino,15.0,2026-07-23
Fruta,1.0,2026-07-23
Fruta Tropical,2.0,2026-07-23
Ice Tea,3.0,2026-07-23
Maça Assada,2.0,2026-07-23
Menu Dia,9.0,2026-07-23
Mouse,5.0,2026-07-23
Omelete Camarão,1.0,2026-07-23
Ovos Rotos,1.0,2026-07-23
Pera Bêbada,1.0,2026-07-23
Polvo Ensalsado,1.0,2026-07-23
Polvo à Lagareiro,1.0,2026-07-23
Prato do dia Carne,6.0,2026-07-23
Prato do dia Peixe,12.0,2026-07-23
Pudim,1.0,2026-07-23
Sopa de Marisco,1.0,2026-07-23
Sopa de Peixe,4.0,2026-07-23
Sumo (copo),2.0,2026-07-23
Take Away,1.0,2026-07-23
Tostas de Rabo de Boi,1.0,2026-07-23
Vinho 0.5L,3.0,2026-07-23
Vinho Branco da casa (copo),4.0,2026-07-23
Vinho Tinto da casa (copo),1.0,2026-07-23
Água 0.5L,10.0,2026-07-23
Água c/gás,8.0,2026-07-23
Alheira,1.0,2026-07-24
Ameijoas à Bulhão Pato,4.0,2026-07-24
Amendoa Amarga,2.0,2026-07-24
Arroz de Rabo de Boi,1.0,2026-07-24
Arroz de Tamboril,2.0,2026-07-24
Azeitonas,1.0,2026-07-24
BR Duvalley,1.0,2026-07-24
BR Papa Figos,2.0,2026-07-24
BR Ribeiro Santo Encruzado,1.0,2026-07-24
BR Vinha Grande,1.0,2026-07-24
Bacalhau à Brás,3.0,2026-07-24
Bacalhau à Lagareiro,1.0,2026-07-24
Bebida Dia,20.0,2026-07-24
Bolinhas de Alheira (3 Un.),1.0,2026-07-24
Café,18.0,2026-07-24
Camarao ao alho,1.0,2026-07-24
Carne de Porco à Alentejana,1.0,2026-07-24
Cesto de Pão,4.0,2026-07-24
Chouriço Assado,1.0,2026-07-24
Coca-Cola,3.0,2026-07-24
Couvert,7.0,2026-07-24
Delicia de Chocolate,1.0,2026-07-24
Doce da casa,4.0,2026-07-24
Dourada/Robalo Grelhado,2.0,2026-07-24
Filetes Peixe Galo,34.5,2026-07-24
Filetes de Polvo,3.5,2026-07-24
Fino,8.0,2026-07-24
Ice Tea,1.0,2026-07-24
Maça Assada,1.0,2026-07-24
Menu Dia,10.0,2026-07-24
Mouse,5.0,2026-07-24
Ovos Rotos,2.0,2026-07-24
Pera Bêbada,2.0,2026-07-24
Picanha,1.0,2026-07-24
Prato do dia Carne,8.0,2026-07-24
Prato do dia Peixe,12.0,2026-07-24
Prego,2.0,2026-07-24
RS Titular Rosé,1.0,2026-07-24
Salada,1.0,2026-07-24
Sopa,4.0,2026-07-24
Sopa de Peixe,1.0,2026-07-24
TT V.Nídeo Reserva,2.0,2026-07-24
Take Away,6.0,2026-07-24
Tostas de Rabo de Boi,2.0,2026-07-24
V Muralhas,1.0,2026-07-24
Vinho 1L,3.0,2026-07-24
Vinho Menu,1.0,2026-07-24
Vinho Tinto da casa (copo),1.0,2026-07-24
Água 0.5L,5.0,2026-07-24
Alheira,1.0,2026-07-25
Ameijoas à Bulhão Pato,1.0,2026-07-25
Arroz de Marisco 2Pax,2.0,2026-07-25
Arroz de Polvo,3.0,2026-07-25
Arroz de Rabo de Boi,1.0,2026-07-25
Arroz de Tamboril,2.0,2026-07-25
BR Monte Peceguinha,2.0,2026-07-25
BR Ribeiro Santo Encruzado,1.0,2026-07-25
BR Valle do Nídeo,2.0,2026-07-25
Bacalhau à Lagareiro,1.0,2026-07-25
Bebida Dia,12.0,2026-07-25
Bolinhas Alheira (6 Un.),2.0,2026-07-25
Café,31.0,2026-07-25
Caldo Verde,3.0,2026-07-25
Camarao ao alho,1.0,2026-07-25
Carne de Porco à Alentejana,5.0,2026-07-25
Cesto de Pão,1.0,2026-07-25
Coca-Cola,2.0,2026-07-25
Couvert,6.0,2026-07-25
Coxa de Pato Confitada,2.0,2026-07-25
Delicia de Chocolate,2.0,2026-07-25
Doce da casa,5.0,2026-07-25
Dourada/Robalo Grelhado,2.0,2026-07-25
ES Quinta Monteirinhos,1.0,2026-07-25
Filetes Peixe Galo,12.0,2026-07-25
Filetes de Polvo,6.0,2026-07-25
Fino,10.0,2026-07-25
Fruta,1.0,2026-07-25
Fruta Tropical,1.0,2026-07-25
Ice Tea,1.0,2026-07-25
Magret de Pato,1.0,2026-07-25
Maça Assada,1.0,2026-07-25
Menu Dia,6.0,2026-07-25
Mouse,8.0,2026-07-25
Ovos Rotos,4.0,2026-07-25
Pera Bêbada,1.0,2026-07-25
Picanha,1.0,2026-07-25
Polvo à Lagareiro,1.0,2026-07-25
Prato do dia Carne,10.0,2026-07-25
Prato do dia Peixe,12.0,2026-07-25
Prego,1.0,2026-07-25
Pudim,3.0,2026-07-25
Salada,1.0,2026-07-25
Sangria 1.5L,1.0,2026-07-25
Sangria 1L,1.0,2026-07-25
Sopa,1.0,2026-07-25
Sopa de Marisco,2.0,2026-07-25
Sopa de Peixe,6.0,2026-07-25
TT Dona Matilde Res,2.0,2026-07-25
TT V.Nídeo Reserva,1.0,2026-07-25
Taça de Gelado,1.0,2026-07-25
Tostas de Rabo de Boi,2.0,2026-07-25
V Muralhas,1.0,2026-07-25
Vinho 0.5L,3.0,2026-07-25
Vinho Branco da casa (copo),2.0,2026-07-25
Vinho Tinto da casa (copo),2.0,2026-07-25
Água 0.5L,20.0,2026-07-25
Água c/gás,3.0,2026-07-25
Ameijoas à Bulhão Pato,1.0,2026-07-27
Arroz Doce,2.0,2026-07-27
Arroz de Polvo,1.0,2026-07-27
Arroz de Tamboril,3.0,2026-07-27
BR Piano Moscatel Galego,1.0,2026-07-27
BR Vinha Grande,1.0,2026-07-27
Bacalhau à Brás,1.0,2026-07-27
Bacalhau à Lagareiro,1.0,2026-07-27
Bebida Dia,58.0,2026-07-27
Bife Lombo,1.0,2026-07-27
Bife de Atum,2.0,2026-07-27
Bolinhas Alheira (6 Un.),1.0,2026-07-27
Bolinhas de Alheira (3 Un.),1.0,2026-07-27
Café,37.0,2026-07-27
Caldo Verde,1.0,2026-07-27
Cesto de Pão,2.0,2026-07-27
Chouriço Assado,1.0,2026-07-27
Coca-Cola,7.0,2026-07-27
Couvert,11.0,2026-07-27
Doce da casa,14.0,2026-07-27
Dourada/Robalo Grelhado,1.0,2026-07-27
Entrecôte,5.0,2026-07-27
Filetes Peixe Galo,16.5,2026-07-27
Filetes de Polvo,6.5,2026-07-27
Fino,2.0,2026-07-27
Fruta Tropical,2.0,2026-07-27
Ice Tea,6.0,2026-07-27
Magret de Pato,1.0,2026-07-27
Maça Assada,4.0,2026-07-27
Melão com Presunto,1.0,2026-07-27
Menu Dia,51.31,2026-07-27
"Menu Dia,Prato do dia Carne,Bebida Dia",1.34,2026-07-27
"Menu Dia,Prato do dia Peixe,Bebida Dia",5.35,2026-07-27
Mouse,8.0,2026-07-27
Ovos Rotos,3.0,2026-07-27
Pera Bêbada,2.0,2026-07-27
Picanha,2.0,2026-07-27
Polvo Ensalsado,1.0,2026-07-27
Polvo à Lagareiro,2.0,2026-07-27
Posta,1.0,2026-07-27
Prato do dia Carne,24.0,2026-07-27
Prato do dia Peixe,34.0,2026-07-27
Pudim,4.0,2026-07-27
RS Titular Rosé,2.0,2026-07-27
Sandwich Club,1.0,2026-07-27
Sangria Espumante 1.5L,1.0,2026-07-27
Sopa de Marisco,1.0,2026-07-27
Sopa de Peixe,6.0,2026-07-27
TT QUINTA VENTOZELO,1.0,2026-07-27
Take Away,1.0,2026-07-27
Tostas de Rabo de Boi,12.0,2026-07-27
V Regueiro,4.0,2026-07-27
Vinho 0.5L,1.0,2026-07-27
Vinho 1L,1.0,2026-07-27
Vinho Branco da casa (copo),1.0,2026-07-27
Vinho Menu,1.0,2026-07-27
Água 0.5L,12.0,2026-07-27
Água c/gás,2.0,2026-07-27
Arroz Doce,2.0,2026-07-28
Arroz de Polvo,1.0,2026-07-28
Arroz de Rabo de Boi,1.0,2026-07-28
BR Ribeiro Santo Encruzado,3.0,2026-07-28
Bacalhau à Brás,1.0,2026-07-28
Batata dose,1.0,2026-07-28
Bebida Dia,26.0,2026-07-28
Bolinhas de Alheira (3 Un.),1.0,2026-07-28
CRF-Reserva,1.0,2026-07-28
Café,18.0,2026-07-28
Caldo Verde,2.0,2026-07-28
Camarao ao alho,1.0,2026-07-28
Camarão da Costa,1.0,2026-07-28
Carne de Porco à Alentejana,1.0,2026-07-28
Chouriço Assado,1.0,2026-07-28
Couvert,7.0,2026-07-28
Doce da casa,4.0,2026-07-28
Dourada/Robalo Grelhado,1.0,2026-07-28
Entrecôte,1.0,2026-07-28
Filetes Peixe Galo,17.5,2026-07-28
Filetes de Polvo,1.0,2026-07-28
Fino,2.0,2026-07-28
Gin Paragon,2.0,2026-07-28
Manteiga,4.0,2026-07-28
Maça Assada,1.0,2026-07-28
Melão com Presunto,2.0,2026-07-28
Menu 25€,6.0,2026-07-28
Menu Degustação Simples,12.0,2026-07-28
Menu Dia,13.0,2026-07-28
Mini Sagres,4.0,2026-07-28
Mouse,4.0,2026-07-28
Pica-pau,1.0,2026-07-28
Polvo à Lagareiro,1.0,2026-07-28
Prato do dia Carne,8.0,2026-07-28
Prato do dia Peixe,20.0,2026-07-28
Prego,1.0,2026-07-28
Pudim,1.0,2026-07-28
Queijo Couvert,1.0,2026-07-28
Seven Up,2.0,2026-07-28
Sopa,2.0,2026-07-28
Take Away,4.0,2026-07-28
Tostas de Rabo de Boi,2.0,2026-07-28
Vegetariano,1.0,2026-07-28
Vinho 0.5L,2.0,2026-07-28
Vinho Branco da casa (copo),3.0,2026-07-28
Vinho Menu,18.0,2026-07-28
Água 0.5L,7.0,2026-07-28
Água c/gás,3.0,2026-07-28
Ameijoas à Bulhão Pato,1.0,2026-07-29
Arroz Doce,3.0,2026-07-29
Arroz de Polvo,1.0,2026-07-29
BR Qta Portal Moscatel,3.0,2026-07-29
BR Ribeiro Santo Encruzado,2.0,2026-07-29
BR Valle do Nídeo,2.0,2026-07-29
Bacalhau à Brás,2.0,2026-07-29
Bacalhau à Lagareiro,3.0,2026-07-29
Bebida Dia,44.0,2026-07-29
Bife Lombo,1.0,2026-07-29
Bife de Atum,1.0,2026-07-29
Bolinhas de Alheira (3 Un.),1.0,2026-07-29
Café,22.0,2026-07-29
Camarao ao alho,1.0,2026-07-29
Carne de Porco à Alentejana,1.0,2026-07-29
Cerveja S/Alcool,1.0,2026-07-29
Coca-Cola,5.0,2026-07-29
Couvert,11.0,2026-07-29
Delicia de Chocolate,4.0,2026-07-29
Doce da casa,7.0,2026-07-29
Dourada/Robalo Grelhado,4.0,2026-07-29
E Quinta Ortigão,1.0,2026-07-29
Entrecôte,4.0,2026-07-29
Filetes Peixe Galo,19.5,2026-07-29
Filetes de Polvo,11.5,2026-07-29
Fino,9.0,2026-07-29
Fruta,2.0,2026-07-29
Fruta Tropical,2.0,2026-07-29
Maça Assada,1.0,2026-07-29
Menu Dia,23.0,2026-07-29
Mini Sagres,1.0,2026-07-29
Mouse,2.0,2026-07-29
Ovos Rotos,4.0,2026-07-29
Pera Bêbada,4.0,2026-07-29
Pica-Pau Terra e Mar,2.0,2026-07-29
Prato do dia Carne,24.0,2026-07-29
Prato do dia Peixe,22.0,2026-07-29
RS Papa Figos,1.0,2026-07-29
Sangria 1.5L,1.0,2026-07-29
Sangria Espumante 1.5L,1.0,2026-07-29
Seven Up,1.0,2026-07-29
Sopa de Marisco,1.0,2026-07-29
Sopa de Peixe,2.0,2026-07-29
Take Away,1.0,2026-07-29
Tostas de Rabo de Boi,3.0,2026-07-29
V Muralhas,2.0,2026-07-29
Vegetariano,1.0,2026-07-29
Vinho Menu,1.0,2026-07-29
Água 0.5L,17.0,2026-07-29
Água Menu,2.0,2026-07-29
Água c/gás,3.0,2026-07-29
Ameijoas à Bulhão Pato,1.0,2026-07-30
Arroz de Polvo,1.0,2026-07-30
Arroz de Rabo de Boi,1.0,2026-07-30
Arroz de Tamboril,1.0,2026-07-30
BR Ribeiro Santo Encruzado,1.0,2026-07-30
Bacalhau à Lagareiro,5.0,2026-07-30
Batata dose,1.0,2026-07-30
Bebida Dia,18.0,2026-07-30
Bife de Atum,1.0,2026-07-30
Black Pig,1.0,2026-07-30
Bolinhas Alheira (6 Un.),1.0,2026-07-30
Café,17.0,2026-07-30
Carne de Porco à Alentejana,1.0,2026-07-30
Cataplana de Peixe 2Pax,3.0,2026-07-30
Cesto de Pão,2.0,2026-07-30
Coca-Cola,3.0,2026-07-30
Couvert,7.0,2026-07-30
Coxa de Pato Confitada,2.0,2026-07-30
Doce da casa,7.0,2026-07-30
Dourada/Robalo Grelhado,1.0,2026-07-30
Entrecôte,4.0,2026-07-30
Filetes Peixe Galo,11.0,2026-07-30
Filetes de Polvo,5.0,2026-07-30
Fino,9.0,2026-07-30
Fruta Tropical,3.0,2026-07-30
Ice Tea,5.0,2026-07-30
Jameson,1.0,2026-07-30
Manteiga,2.0,2026-07-30
Maça Assada,1.0,2026-07-30
Menu Dia,17.0,2026-07-30
"Menu Dia,Prato do dia Peixe,Bebida Dia",1.0,2026-07-30
Mouse,5.0,2026-07-30
Pera Bêbada,1.0,2026-07-30
Picanha,2.0,2026-07-30
Polvo Ensalsado,3.0,2026-07-30
Prato do dia Carne,6.0,2026-07-30
Prato do dia Peixe,12.0,2026-07-30
Queijo Couvert,1.0,2026-07-30
Salada,1.0,2026-07-30
Sangria 1.5L,2.0,2026-07-30
Sangria Espumante 1.5L,1.0,2026-07-30
Sopa de Peixe,4.0,2026-07-30
TT Esteva,1.0,2026-07-30
Take Away,3.0,2026-07-30
Tostas de Rabo de Boi,1.0,2026-07-30
V Muralhas,1.0,2026-07-30
Vegetariano,1.0,2026-07-30
Vinho 1L,1.0,2026-07-30
Vinho Tinto da casa (copo),1.0,2026-07-30
Água 0.5L,8.0,2026-07-30
Água c/gás,3.0,2026-07-30
Ameijoas à Bulhão Pato,1.0,2026-07-31
Arroz Doce,2.0,2026-07-31
Arroz de Polvo,1.0,2026-07-31
Arroz de Tamboril,3.0,2026-07-31
Arroz dose,1.0,2026-07-31
BR Ribeiro Santo Encruzado,3.0,2026-07-31
BR Valle do Nídeo,2.0,2026-07-31
BR Vinha Grande,1.0,2026-07-31
Bacalhau à Brás,4.0,2026-07-31
Bebida Dia,14.0,2026-07-31
Bife Lombo,1.0,2026-07-31
Bife de Atum,2.0,2026-07-31
Café,21.0,2026-07-31
Camarao ao alho,1.0,2026-07-31
Carne de Porco à Alentejana,3.0,2026-07-31
Cerveja S/Alcool,1.0,2026-07-31
Coca-Cola,9.0,2026-07-31
Compal Néctar,2.0,2026-07-31
Couvert,5.0,2026-07-31
Doce da casa,3.0,2026-07-31
ES Ortigão Nektar,1.0,2026-07-31
ES S. Domingos Extra Reserva,1.0,2026-07-31
Entrecôte,5.0,2026-07-31
Filetes Peixe Galo,7.0,2026-07-31
Filetes de Polvo,5.0,2026-07-31
Fino,8.0,2026-07-31
Fruta,1.0,2026-07-31
Manteiga,2.0,2026-07-31
Maça Assada,5.0,2026-07-31
Melão com Presunto,2.0,2026-07-31
Menu Dia,13.25,2026-07-31
Mouse,4.0,2026-07-31
Omelete Camarão,1.0,2026-07-31
Pera Bêbada,1.0,2026-07-31
Polvo Ensalsado,1.0,2026-07-31
Polvo à Lagareiro,1.0,2026-07-31
Prato do dia Carne,2.0,2026-07-31
Prato do dia Peixe,12.0,2026-07-31
Prego,1.0,2026-07-31
Pudim,2.0,2026-07-31
Queijo Couvert,1.0,2026-07-31
RS Papa Figos,1.0,2026-07-31
RS Titular Rosé,5.0,2026-07-31
Salada,1.0,2026-07-31
Seven Up,1.0,2026-07-31
Sopa de Peixe,7.0,2026-07-31
Tostas de Rabo de Boi,5.0,2026-07-31
Vegetariano,1.0,2026-07-31
Vinho 0.5L,4.0,2026-07-31
Vinho Branco da casa (copo),2.0,2026-07-31
Vinho Tinto da casa (copo),1.0,2026-07-31
Água 0.5L,12.0,2026-07-31
Água c/gás,6.0,2026-07-31
Ameijoas à Bulhão Pato,2.0,2026-08-01
Arroz de Polvo,1.0,2026-08-01
Arroz de Tamboril,2.0,2026-08-01
Azeitonas,1.0,2026-08-01
BR Papa Figos,2.0,2026-08-01
BR Planalto,1.0,2026-08-01
BR Ribeiro Santo Encruzado,3.0,2026-08-01
BR Valle do Nídeo,1.0,2026-08-01
Bacalhau à Brás,1.0,2026-08-01
Batata dose,1.0,2026-08-01
Beirão,1.0,2026-08-01
Bife Lombo,2.0,2026-08-01
Bife de Atum,2.0,2026-08-01
Bolinhas Alheira (6 Un.),1.0,2026-08-01
Bolinhas de Alheira (3 Un.),1.0,2026-08-01
Café,31.0,2026-08-01
Carne de Porco à Alentejana,1.0,2026-08-01
Cerveja S/Alcool,1.0,2026-08-01
Cesto de Pão,3.0,2026-08-01
Chouriço Assado,1.0,2026-08-01
Coca-Cola,7.0,2026-08-01
Couvert,8.0,2026-08-01
Doce da casa,9.0,2026-08-01
Dourada/Robalo Grelhado,2.0,2026-08-01
Entrecôte,4.0,2026-08-01
Filetes Peixe Galo,39.5,2026-08-01
Filetes de Polvo,17.5,2026-08-01
Fino,17.0,2026-08-01
Ice Tea,5.0,2026-08-01
Melão com Presunto,1.0,2026-08-01
Mouse,3.0,2026-08-01
Ovos Rotos,2.0,2026-08-01
Pera Bêbada,2.0,2026-08-01
Picanha,3.0,2026-08-01
Polvo Ensalsado,2.0,2026-08-01
Polvo à Lagareiro,1.0,2026-08-01
Prato do dia Carne,5.0,2026-08-01
Prato do dia Peixe,12.0,2026-08-01
Prego,1.0,2026-08-01
Pudim,1.0,2026-08-01
RS Titular Rosé,3.0,2026-08-01
Salada,1.0,2026-08-01
Sangria 1.5L,2.0,2026-08-01
Sopa,3.0,2026-08-01
Sopa de Marisco,1.0,2026-08-01
Sopa de Peixe,5.0,2026-08-01
TT Papa Figos,1.0,2026-08-01
Take Away,2.0,2026-08-01
Taça de Gelado,3.0,2026-08-01
Vinho 0.5L,1.0,2026-08-01
Vinho 1L,2.0,2026-08-01
Vinho Tinto da casa (copo),1.0,2026-08-01
Água 0.5L,19.0,2026-08-01
Água c/gás,3.0,2026-08-01
Ameijoas à Bulhão Pato,1.0,2026-08-03
Arroz de Polvo,3.0,2026-08-03
Arroz de Tamboril,3.0,2026-08-03
BR Luis Pato Vinhas Velhas,1.0,2026-08-03
Bacalhau à Brás,1.0,2026-08-03
Bacalhau à Lagareiro,1.0,2026-08-03
Bebida Dia,24.0,2026-08-03
Bife Lombo,1.0,2026-08-03
Bife de Atum,1.0,2026-08-03
Brandy Croft,1.0,2026-08-03
Café,32.0,2026-08-03
Camarao ao alho,2.0,2026-08-03
Carne de Porco à Alentejana,2.0,2026-08-03
Cerveja S/Alcool,1.0,2026-08-03
Cesto de Pão,2.0,2026-08-03
Coca-Cola,4.0,2026-08-03
Couvert,9.0,2026-08-03
Doce da casa,8.0,2026-08-03
Dourada/Robalo Grelhado,3.0,2026-08-03
Filetes Peixe Galo,31.5,2026-08-03
Fino,3.0,2026-08-03
Ice Tea,3.0,2026-08-03
Melão com Presunto,1.0,2026-08-03
Menu Dia,12.0,2026-08-03
Mouse,1.0,2026-08-03
Omelete Camarão,1.0,2026-08-03
Ovos Rotos,2.0,2026-08-03
Pera Bêbada,3.0,2026-08-03
Picanha,2.0,2026-08-03
Polvo à Lagareiro,2.0,2026-08-03
Prato do dia Carne,16.0,2026-08-03
Prato do dia Peixe,8.0,2026-08-03
Prego,1.0,2026-08-03
Pudim,6.0,2026-08-03
Queijo Couvert,2.0,2026-08-03
Salada,1.0,2026-08-03
Seven Up,2.0,2026-08-03
Sopa,1.0,2026-08-03
Sopa de Marisco,1.0,2026-08-03
Sopa de Peixe,4.0,2026-08-03
Take Away,7.0,2026-08-03
V Muralhas,1.0,2026-08-03
Vinho 0.5L,6.0,2026-08-03
Vinho 1L,1.0,2026-08-03
Vinho Branco da casa (copo),3.0,2026-08-03
Vinho Menu,1.0,2026-08-03
Vinho Tinto da casa (copo),1.0,2026-08-03
Água 0.5L,11.0,2026-08-03
Água c/gás,1.0,2026-08-03
Ameijoas à Bulhão Pato,2.0,2026-08-04
Arroz de Polvo,2.0,2026-08-04
Arroz de Rabo de Boi,4.0,2026-08-04
Arroz de Tamboril,5.0,2026-08-04
BR Volupia,1.0,2026-08-04
Bacalhau à Brás,1.0,2026-08-04
Bacalhau à Lagareiro,1.0,2026-08-04
Bebida Dia,28.0,2026-08-04
Beirão,1.0,2026-08-04
Bife de Atum,2.0,2026-08-04
Café,23.0,2026-08-04
Caldo Verde,1.0,2026-08-04
Camarão da Costa,1.0,2026-08-04
Carne de Porco à Alentejana,1.0,2026-08-04
Cesto de Pão,2.0,2026-08-04
Coca-Cola,2.0,2026-08-04
Compal Néctar,2.0,2026-08-04
Couvert,4.0,2026-08-04
Doce da casa,9.0,2026-08-04
Dourada/Robalo Grelhado,2.0,2026-08-04
ES S. Domingos Extra Reserva,1.0,2026-08-04
Filetes Peixe Galo,6.0,2026-08-04
Filetes de Polvo,9.5,2026-08-04
Fino,11.0,2026-08-04
Ice Tea,3.0,2026-08-04
Manteiga,2.0,2026-08-04
Menu 25€,7.0,2026-08-04
"Menu 25€,Menu Degustação Simples,Vinho Menu",8.0,2026-08-04
Menu Degustação Simples,16.0,2026-08-04
Menu Dia,14.0,2026-08-04
Ovos Rotos,2.0,2026-08-04
Polvo à Lagareiro,1.0,2026-08-04
Prato do dia Peixe,28.0,2026-08-04
Pudim,2.0,2026-08-04
Seven Up,1.0,2026-08-04
Sopa,3.0,2026-08-04
Sopa de Peixe,2.0,2026-08-04
TT Esteva,1.0,2026-08-04
Take Away,3.0,2026-08-04
Taça de Gelado,1.0,2026-08-04
Vinho 0.5L,4.0,2026-08-04
Vinho Branco da casa (copo),3.0,2026-08-04
Vinho Menu,16.0,2026-08-04
Vinho Tinto da casa (copo),2.0,2026-08-04
Água 0.5L,12.0,2026-08-04
Água c/gás,3.0,2026-08-04`;
const PURCHASES_CSV_RAW = `item,quantity,unit,unitPrice,date,supplier
Alface,0.33,kg,1.4155,2026-01-05,Hortofrutícola Vale Verde
Alho,0.34,kg,4.581,2026-01-05,Hortofrutícola Vale Verde
Ameijoas,3.37,kg,14.2267,2026-01-05,Peixaria do Porto
Arroz,1.5,kg,1.6156,2026-01-05,Mercearia Atlântico
Azeite,2.09,l,6.0328,2026-01-05,Mercearia Atlântico
Azeitonas,1.73,kg,4.8632,2026-01-05,Mercearia Atlântico
Açúcar,0.54,kg,1.2219,2026-01-05,Mercearia Atlântico
BR GALHARDINI,0.91,l,2.424,2026-01-05,Garrafeira Nacional
BR Luis Pato Maria Gomes,0.78,l,2.6399,2026-01-05,Garrafeira Nacional
BR Papa Figos,1.62,l,3.3539,2026-01-05,Garrafeira Nacional
BR Qta Lemos D.Paulette,0.65,l,15.0241,2026-01-05,Garrafeira Nacional
BR Qta Portal Moscatel,0.96,l,3.8404,2026-01-05,Garrafeira Nacional
BR Ribeiro Santo Encruzado,0.75,l,3.9467,2026-01-05,Garrafeira Nacional
BR Valle do Nídeo,0.93,l,2.2589,2026-01-05,Garrafeira Nacional
Bacalhau desfiado,0.64,kg,25.3286,2026-01-05,Peixaria do Porto
Bacon,0.08,kg,9.9371,2026-01-05,Talho Central
Batata,7.48,kg,1.1086,2026-01-05,Hortofrutícola Vale Verde
Batata a murro,0.83,kg,1.1101,2026-01-05,Hortofrutícola Vale Verde
Batata cozida,1.72,kg,1.0891,2026-01-05,Hortofrutícola Vale Verde
Batata frita,2.87,kg,1.2197,2026-01-05,Hortofrutícola Vale Verde
Batata palha,0.77,kg,1.3578,2026-01-05,Hortofrutícola Vale Verde
Beirão,0.04,l,23.0542,2026-01-05,Bebidas & Companhia
Bife de atum,0.39,kg,21.7279,2026-01-05,Peixaria do Porto
Bife de vaca,0.15,kg,17.2987,2026-01-05,Talho Central
Bolo de chocolate,0.39,kg,6.8669,2026-01-05,Mercearia Atlântico
CRF-Reserva,0.05,l,31.3987,2026-01-05,Bebidas & Companhia
Café moído,1.32,kg,22.1287,2026-01-05,Mercearia Atlântico
Camarão,0.41,kg,18.2815,2026-01-05,Peixaria do Porto
Camarão da costa,0.15,kg,29.7256,2026-01-05,Peixaria do Porto
Canela,0.04,kg,17.1133,2026-01-05,Mercearia Atlântico
Cebola,0.35,kg,0.991,2026-01-05,Hortofrutícola Vale Verde
Cenoura,0.12,kg,1.0585,2026-01-05,Hortofrutícola Vale Verde
Chocolate,0.07,kg,9.9166,2026-01-05,Mercearia Atlântico
Coca-Cola,3.02,l,2.0962,2026-01-05,Distribuidora Refrescos Lda
Coentros,0.08,kg,9.2803,2026-01-05,Hortofrutícola Vale Verde
Entrecosto de porco,1.75,kg,8.029,2026-01-05,Talho Central
Entrecôte,2.42,kg,18.8358,2026-01-05,Talho Central
Filetes de peixe galo,8.36,kg,19.5834,2026-01-05,Peixaria do Porto
Filetes de polvo,1.84,kg,16.3065,2026-01-05,Peixaria do Porto
Frango,0.17,kg,5.3017,2026-01-05,Talho Central
Fruta da época,0.35,kg,2.1073,2026-01-05,Hortofrutícola Vale Verde
Gelado,0.11,kg,6.0143,2026-01-05,Mercearia Atlântico
Ingredientes variados,2.21,kg,4.8815,2026-01-05,Mercearia Atlântico
Jameson,0.04,l,30.9131,2026-01-05,Bebidas & Companhia
Legumes,2.71,kg,1.849,2026-01-05,Hortofrutícola Vale Verde
Legumes salteados,0.21,kg,1.7886,2026-01-05,Hortofrutícola Vale Verde
Legumes variados,1.51,kg,1.8146,2026-01-05,Hortofrutícola Vale Verde
Limão,0.03,kg,2.4239,2026-01-05,Hortofrutícola Vale Verde
Lombo de bacalhau,0.8,kg,33.1112,2026-01-05,Peixaria do Porto
Lombo de vaca,0.54,kg,19.5307,2026-01-05,Talho Central
Maionese,0.03,kg,3.5052,2026-01-05,Mercearia Atlântico
Manteiga,0.99,kg,6.9335,2026-01-05,Lacticínios Serra
Marisco,0.16,kg,16.8018,2026-01-05,Peixaria do Porto
Martini Bianco,0.04,l,17.5134,2026-01-05,Bebidas & Companhia
Maçã,1.39,kg,1.7181,2026-01-05,Hortofrutícola Vale Verde
Melão,1.0,kg,1.5304,2026-01-05,Hortofrutícola Vale Verde
Mini Sagres,4.98,l,2.7411,2026-01-05,Distribuidora Refrescos Lda
Molho,0.28,l,6.0004,2026-01-05,Mercearia Atlântico
Molho de frutos vermelhos,0.14,l,5.8633,2026-01-05,Mercearia Atlântico
Mostarda,0.01,kg,3.6382,2026-01-05,Mercearia Atlântico
Ovos,17.0,unit,0.2369,2026-01-05,Lacticínios Serra
Peito de pato,1.14,kg,13.568,2026-01-05,Talho Central
Peixe variado,4.24,kg,12.2668,2026-01-05,Peixaria do Porto
Pera,2.26,kg,2.2033,2026-01-05,Hortofrutícola Vale Verde
Picanha,0.18,kg,17.6507,2026-01-05,Talho Central
Pimento,0.06,kg,2.4313,2026-01-05,Hortofrutícola Vale Verde
Polvo,1.04,kg,14.964,2026-01-05,Peixaria do Porto
Polvo cozido,0.23,kg,13.9184,2026-01-05,Peixaria do Porto
Posta de vaca,0.48,kg,18.395,2026-01-05,Talho Central
Presunto,0.43,kg,21.5045,2026-01-05,Talho Central
"Pudim (leite, ovos, açúcar)",0.78,kg,4.7596,2026-01-05,Mercearia Atlântico
Pão,5.33,kg,3.5534,2026-01-05,Padaria Forno Antigo
Pão de forma,0.21,kg,4.2383,2026-01-05,Padaria Forno Antigo
RS Papa Figos,0.79,l,3.2053,2026-01-05,Garrafeira Nacional
Rabo de boi,0.49,kg,10.3937,2026-01-05,Talho Central
Rabo de boi desfiado,1.2,kg,10.362,2026-01-05,Talho Central
Sangria 1.5L,3.66,l,5.2343,2026-01-05,Distribuidora Refrescos Lda
Sangria 1L,1.01,l,5.7096,2026-01-05,Distribuidora Refrescos Lda
Saqueta de chá,1.0,unit,0.0969,2026-01-05,Mercearia Atlântico
Seven Up,0.62,l,2.2677,2026-01-05,Distribuidora Refrescos Lda
TT Ribeiro Santo Res,2.7,l,3.1603,2026-01-05,Garrafeira Nacional
TT V.Nídeo Reserva,4.47,l,2.5378,2026-01-05,Garrafeira Nacional
Tamboril,1.36,kg,16.8347,2026-01-05,Peixaria do Porto
Tomate,2.4,kg,1.7903,2026-01-05,Hortofrutícola Vale Verde
V Muralhas,1.8,l,1.8078,2026-01-05,Garrafeira Nacional
Vinagre,0.03,l,1.8158,2026-01-05,Mercearia Atlântico
Vinho 0.5L,9.99,l,2.6968,2026-01-05,Distribuidora Refrescos Lda
Vinho 1L,2.52,l,0.7244,2026-01-05,Distribuidora Refrescos Lda
Vinho Branco da casa (copo),0.25,l,8.3495,2026-01-05,Distribuidora Refrescos Lda
Vinho Menu,4.79,l,2.5995,2026-01-05,Distribuidora Refrescos Lda
Vinho Tinto da casa (copo),0.53,l,7.9926,2026-01-05,Distribuidora Refrescos Lda
Vinho branco,0.14,l,2.8854,2026-01-05,Mercearia Atlântico
Vinho do Porto (dose),0.21,l,12.1823,2026-01-05,Bebidas & Companhia
Vinho tinto,1.62,l,3.0914,2026-01-05,Mercearia Atlântico
Água 0.33L,0.4,l,1.4663,2026-01-05,Distribuidora Refrescos Lda
Água 0.5L,11.08,l,1.1489,2026-01-05,Distribuidora Refrescos Lda
Água Ardente,0.3,l,30.6462,2026-01-05,Bebidas & Companhia
Água c/gás,1.08,l,2.5786,2026-01-05,Distribuidora Refrescos Lda
Alface,0.33,kg,1.4504,2026-01-12,Hortofrutícola Vale Verde
Alheira,0.12,kg,9.5561,2026-01-12,Talho Central
Alho,0.68,kg,4.6076,2026-01-12,Hortofrutícola Vale Verde
Ameijoas,2.47,kg,14.5948,2026-01-12,Peixaria do Porto
Amendoa Amarga,0.09,l,18.785,2026-01-12,Bebidas & Companhia
Arroz,1.89,kg,1.5741,2026-01-12,Mercearia Atlântico
Azeite,3.55,l,6.2416,2026-01-12,Mercearia Atlântico
Azeitonas,2.53,kg,4.7601,2026-01-12,Mercearia Atlântico
Açúcar,0.69,kg,1.1559,2026-01-12,Mercearia Atlântico
BR Monte Peceguinha,0.67,l,5.7505,2026-01-12,Garrafeira Nacional
BR Ribeiro Santo Encruzado,0.75,l,4.0456,2026-01-12,Garrafeira Nacional
BR Vinha Grande,0.89,l,4.9294,2026-01-12,Garrafeira Nacional
BR Volupia,0.75,l,3.5705,2026-01-12,Garrafeira Nacional
Bacalhau desfiado,1.91,kg,26.7684,2026-01-12,Peixaria do Porto
Bacon,0.08,kg,9.852,2026-01-12,Talho Central
Batata,15.25,kg,1.0835,2026-01-12,Hortofrutícola Vale Verde
Batata a murro,1.25,kg,1.087,2026-01-12,Hortofrutícola Vale Verde
Batata cozida,7.33,kg,1.0571,2026-01-12,Hortofrutícola Vale Verde
Batata frita,2.29,kg,1.2418,2026-01-12,Hortofrutícola Vale Verde
Batata palha,1.54,kg,1.2892,2026-01-12,Hortofrutícola Vale Verde
Bife de atum,0.39,kg,21.0224,2026-01-12,Peixaria do Porto
Bife de vaca,0.15,kg,16.1458,2026-01-12,Talho Central
Black Label,0.26,l,49.3454,2026-01-12,Bebidas & Companhia
Café moído,1.13,kg,21.3114,2026-01-12,Mercearia Atlântico
Camarão,0.74,kg,19.3912,2026-01-12,Peixaria do Porto
Camarão da costa,0.9,kg,29.4825,2026-01-12,Peixaria do Porto
Canela,0.06,kg,18.2059,2026-01-12,Mercearia Atlântico
Carne de vaca,0.26,kg,13.8779,2026-01-12,Talho Central
Cebola,0.56,kg,0.9579,2026-01-12,Hortofrutícola Vale Verde
Cenoura,0.2,kg,1.0674,2026-01-12,Hortofrutícola Vale Verde
Coca-Cola,6.65,l,2.1555,2026-01-12,Distribuidora Refrescos Lda
Coentros,0.05,kg,9.9298,2026-01-12,Hortofrutícola Vale Verde
Compal Néctar,0.68,l,3.7616,2026-01-12,Distribuidora Refrescos Lda
Coxa de pato,0.29,kg,11.9308,2026-01-12,Talho Central
ES S. Domingos Extra Reserva,3.24,l,3.4846,2026-01-12,Garrafeira Nacional
Entrecosto de porco,0.97,kg,8.3827,2026-01-12,Talho Central
Entrecôte,1.21,kg,19.268,2026-01-12,Talho Central
Filetes de peixe galo,18.55,kg,19.7844,2026-01-12,Peixaria do Porto
Filetes de polvo,7.67,kg,15.8074,2026-01-12,Peixaria do Porto
Frango,0.17,kg,5.6151,2026-01-12,Talho Central
Fruta da época,0.18,kg,2.1941,2026-01-12,Hortofrutícola Vale Verde
Gin Hendricks,0.07,l,55.0519,2026-01-12,Bebidas & Companhia
Ingredientes variados,1.99,kg,4.7176,2026-01-12,Mercearia Atlântico
Jameson,0.08,l,29.7558,2026-01-12,Bebidas & Companhia
Legumes,2.03,kg,1.7666,2026-01-12,Hortofrutícola Vale Verde
Legumes salteados,0.21,kg,1.7762,2026-01-12,Hortofrutícola Vale Verde
Legumes variados,1.28,kg,1.7319,2026-01-12,Hortofrutícola Vale Verde
Limão,0.07,kg,2.4725,2026-01-12,Hortofrutícola Vale Verde
Lombo de bacalhau,0.4,kg,34.3717,2026-01-12,Peixaria do Porto
Lombo de vaca,0.54,kg,19.4632,2026-01-12,Talho Central
Maionese,0.03,kg,3.5174,2026-01-12,Mercearia Atlântico
Malagueta,0.01,kg,7.5105,2026-01-12,Hortofrutícola Vale Verde
Manteiga,1.4,kg,7.1863,2026-01-12,Lacticínios Serra
Maçã,2.26,kg,1.8649,2026-01-12,Hortofrutícola Vale Verde
Mini Sagres,1.5,l,2.8444,2026-01-12,Distribuidora Refrescos Lda
Molho,0.14,l,6.0916,2026-01-12,Mercearia Atlântico
Molho de frutos vermelhos,0.07,l,6.1027,2026-01-12,Mercearia Atlântico
Mostarda,0.02,kg,3.7652,2026-01-12,Mercearia Atlântico
Ovos,42.0,unit,0.2314,2026-01-12,Lacticínios Serra
Peito de pato,0.57,kg,13.5621,2026-01-12,Talho Central
Peixe inteiro,1.34,kg,14.8051,2026-01-12,Peixaria do Porto
Peixe variado,2.9,kg,11.837,2026-01-12,Peixaria do Porto
Pera,2.64,kg,2.0725,2026-01-12,Hortofrutícola Vale Verde
Picanha,1.27,kg,18.2091,2026-01-12,Talho Central
Polvo,2.73,kg,13.9267,2026-01-12,Peixaria do Porto
Posta de vaca,0.96,kg,18.5416,2026-01-12,Talho Central
Presunto,0.31,kg,20.7253,2026-01-12,Talho Central
"Pudim (leite, ovos, açúcar)",0.49,kg,5.0336,2026-01-12,Mercearia Atlântico
Pão,7.49,kg,3.7499,2026-01-12,Padaria Forno Antigo
Pão de forma,0.21,kg,4.1301,2026-01-12,Padaria Forno Antigo
Rabo de boi,0.82,kg,10.7329,2026-01-12,Talho Central
Rabo de boi desfiado,1.63,kg,10.9012,2026-01-12,Talho Central
Sangria 1.5L,9.15,l,5.7104,2026-01-12,Distribuidora Refrescos Lda
TT Duvalley Reserva,2.2,l,6.9464,2026-01-12,Garrafeira Nacional
TT Galhardini,2.83,l,3.0433,2026-01-12,Garrafeira Nacional
TT V.Nídeo Reserva,1.79,l,2.5818,2026-01-12,Garrafeira Nacional
Tamboril,0.23,kg,17.3467,2026-01-12,Peixaria do Porto
Tomate,1.69,kg,1.7939,2026-01-12,Hortofrutícola Vale Verde
Vinagre,0.02,l,1.8041,2026-01-12,Mercearia Atlântico
Vinho 0.5L,5.65,l,2.7541,2026-01-12,Distribuidora Refrescos Lda
Vinho 1L,7.55,l,0.7784,2026-01-12,Distribuidora Refrescos Lda
Vinho Branco da casa (copo),0.76,l,8.2361,2026-01-12,Distribuidora Refrescos Lda
Vinho Menu,1.2,l,2.6036,2026-01-12,Distribuidora Refrescos Lda
Vinho Tinto da casa (copo),0.35,l,8.2804,2026-01-12,Distribuidora Refrescos Lda
Vinho branco,0.12,l,3.1439,2026-01-12,Mercearia Atlântico
Vinho tinto,1.95,l,3.0677,2026-01-12,Mercearia Atlântico
Água 0.5L,14.1,l,1.2034,2026-01-12,Distribuidora Refrescos Lda
Água c/gás,2.43,l,2.4344,2026-01-12,Distribuidora Refrescos Lda
Alheira,0.24,kg,9.2222,2026-01-19,Talho Central
Alho,0.3,kg,4.8721,2026-01-19,Hortofrutícola Vale Verde
Ameijoas,3.59,kg,14.232,2026-01-19,Peixaria do Porto
Arroz,1.29,kg,1.5043,2026-01-19,Mercearia Atlântico
Azeite,1.56,l,6.2995,2026-01-19,Mercearia Atlântico
Azeitonas,1.73,kg,4.8508,2026-01-19,Mercearia Atlântico
Açúcar,0.57,kg,1.1608,2026-01-19,Mercearia Atlântico
BR Burmester meia gr.,0.45,l,2.6155,2026-01-19,Garrafeira Nacional
BR Luis Pato Maria Gomes,0.78,l,2.6881,2026-01-19,Garrafeira Nacional
BR Monte Peceguinha,1.34,l,5.8241,2026-01-19,Garrafeira Nacional
BR Ribeiro Santo Colheita,0.74,l,2.1615,2026-01-19,Garrafeira Nacional
Bacalhau desfiado,1.27,kg,26.8126,2026-01-19,Peixaria do Porto
Batata,4.47,kg,1.0428,2026-01-19,Hortofrutícola Vale Verde
Batata a murro,0.42,kg,1.0389,2026-01-19,Hortofrutícola Vale Verde
Batata cozida,1.81,kg,1.0552,2026-01-19,Hortofrutícola Vale Verde
Batata frita,1.68,kg,1.1686,2026-01-19,Hortofrutícola Vale Verde
Batata palha,1.23,kg,1.2588,2026-01-19,Hortofrutícola Vale Verde
Beirão,0.14,l,24.9219,2026-01-19,Bebidas & Companhia
Bife de atum,0.19,kg,22.3547,2026-01-19,Peixaria do Porto
Bolo de chocolate,0.39,kg,6.9853,2026-01-19,Mercearia Atlântico
CRF-Reserva,0.09,l,28.9023,2026-01-19,Bebidas & Companhia
Café moído,0.79,kg,22.2501,2026-01-19,Mercearia Atlântico
Camarão,0.62,kg,19.7314,2026-01-19,Peixaria do Porto
Canela,0.05,kg,17.2651,2026-01-19,Mercearia Atlântico
Carne de vaca,0.26,kg,14.5815,2026-01-19,Talho Central
Cebola,0.26,kg,0.917,2026-01-19,Hortofrutícola Vale Verde
Cenoura,0.08,kg,1.0772,2026-01-19,Hortofrutícola Vale Verde
Chocolate,0.07,kg,9.2399,2026-01-19,Mercearia Atlântico
Coca-Cola,4.53,l,2.225,2026-01-19,Distribuidora Refrescos Lda
Coentros,0.06,kg,9.2068,2026-01-19,Hortofrutícola Vale Verde
Compal Néctar,0.34,l,3.6727,2026-01-19,Distribuidora Refrescos Lda
Coxa de pato,0.29,kg,12.3449,2026-01-19,Talho Central
ES S. Domingos Extra Reserva,0.81,l,3.6523,2026-01-19,Garrafeira Nacional
Entrecosto de porco,0.78,kg,8.7593,2026-01-19,Talho Central
Entrecôte,1.45,kg,19.6708,2026-01-19,Talho Central
Filetes de peixe galo,4.81,kg,19.8742,2026-01-19,Peixaria do Porto
Filetes de polvo,1.08,kg,15.2953,2026-01-19,Peixaria do Porto
Fruta da época,0.18,kg,2.192,2026-01-19,Hortofrutícola Vale Verde
Gelado,0.11,kg,6.142,2026-01-19,Mercearia Atlântico
Ingredientes variados,1.0,kg,4.8022,2026-01-19,Mercearia Atlântico
Jameson,0.04,l,29.7943,2026-01-19,Bebidas & Companhia
Legumes,0.9,kg,1.8246,2026-01-19,Hortofrutícola Vale Verde
Legumes salteados,0.11,kg,1.7203,2026-01-19,Hortofrutícola Vale Verde
Legumes variados,3.33,kg,1.8378,2026-01-19,Hortofrutícola Vale Verde
Limão,0.08,kg,2.287,2026-01-19,Hortofrutícola Vale Verde
Lombo de bacalhau,0.4,kg,33.5132,2026-01-19,Peixaria do Porto
Lombo de vaca,0.54,kg,19.7788,2026-01-19,Talho Central
Manteiga,0.97,kg,6.8689,2026-01-19,Lacticínios Serra
Maçã,1.74,kg,1.8377,2026-01-19,Hortofrutícola Vale Verde
Molho,0.17,l,6.078,2026-01-19,Mercearia Atlântico
Molho de frutos vermelhos,0.1,l,6.0666,2026-01-19,Mercearia Atlântico
Mostarda,0.01,kg,3.5498,2026-01-19,Mercearia Atlântico
Ovos,31.0,unit,0.2281,2026-01-19,Lacticínios Serra
Peito de pato,0.85,kg,13.1048,2026-01-19,Talho Central
Peixe inteiro,0.45,kg,14.0804,2026-01-19,Peixaria do Porto
Peixe variado,1.29,kg,12.3409,2026-01-19,Peixaria do Porto
Pera,2.26,kg,2.0916,2026-01-19,Hortofrutícola Vale Verde
Polvo,0.65,kg,13.7319,2026-01-19,Peixaria do Porto
Posta de vaca,1.92,kg,17.4475,2026-01-19,Talho Central
Presunto,0.31,kg,22.1068,2026-01-19,Talho Central
"Pudim (leite, ovos, açúcar)",0.68,kg,4.7801,2026-01-19,Mercearia Atlântico
Pão,5.03,kg,3.7217,2026-01-19,Padaria Forno Antigo
Rabo de boi,0.33,kg,10.7119,2026-01-19,Talho Central
Rabo de boi desfiado,1.03,kg,11.3186,2026-01-19,Talho Central
Sangria 1.5L,1.83,l,5.5132,2026-01-19,Distribuidora Refrescos Lda
Saqueta de chá,3.0,unit,0.0986,2026-01-19,Mercearia Atlântico
TT A. Mayor Comendador,1.35,l,11.4011,2026-01-19,Garrafeira Nacional
TT Duvalley,3.46,l,2.6121,2026-01-19,Garrafeira Nacional
TT Duvalley Reserva,1.47,l,6.7286,2026-01-19,Garrafeira Nacional
TT Esteva,0.88,l,2.1575,2026-01-19,Garrafeira Nacional
TT Ribeiro Santo Res,1.35,l,3.144,2026-01-19,Garrafeira Nacional
Tamboril,1.36,kg,16.3646,2026-01-19,Peixaria do Porto
Tomate,1.0,kg,1.7457,2026-01-19,Hortofrutícola Vale Verde
V Muralhas,1.8,l,1.9121,2026-01-19,Garrafeira Nacional
Vinho 0.5L,4.78,l,2.7083,2026-01-19,Distribuidora Refrescos Lda
Vinho 1L,6.29,l,0.7651,2026-01-19,Distribuidora Refrescos Lda
Vinho Branco da casa (copo),0.76,l,7.6436,2026-01-19,Distribuidora Refrescos Lda
Vinho Menu,1.5,l,2.4383,2026-01-19,Distribuidora Refrescos Lda
Vinho Tinto da casa (copo),0.53,l,7.8536,2026-01-19,Distribuidora Refrescos Lda
Vinho branco,0.21,l,3.1191,2026-01-19,Mercearia Atlântico
Vinho tinto,1.59,l,3.144,2026-01-19,Mercearia Atlântico
Água 0.5L,11.08,l,1.1654,2026-01-19,Distribuidora Refrescos Lda
Água c/gás,4.05,l,2.3818,2026-01-19,Distribuidora Refrescos Lda
Aguardente,0.02,l,9.9283,2026-01-26,Mercearia Atlântico
Alface,0.28,kg,1.5016,2026-01-26,Hortofrutícola Vale Verde
Alheira,0.12,kg,9.9709,2026-01-26,Talho Central
Alho,0.58,kg,4.9439,2026-01-26,Hortofrutícola Vale Verde
Ameijoas,3.59,kg,13.9571,2026-01-26,Peixaria do Porto
Arroz,1.48,kg,1.582,2026-01-26,Mercearia Atlântico
Azeite,3.14,l,6.2526,2026-01-26,Mercearia Atlântico
Azeitonas,2.49,kg,4.7107,2026-01-26,Mercearia Atlântico
Açúcar,0.61,kg,1.2225,2026-01-26,Mercearia Atlântico
BR Duvalley Reserva,0.9,l,4.477,2026-01-26,Garrafeira Nacional
BR GALHARDINI,0.91,l,2.2042,2026-01-26,Garrafeira Nacional
BR Monte Peceguinha,0.67,l,5.4702,2026-01-26,Garrafeira Nacional
BR Planalto,0.7,l,2.2837,2026-01-26,Garrafeira Nacional
BR Ribeiro Santo Encruzado,0.75,l,4.1552,2026-01-26,Garrafeira Nacional
BR Vinha Grande,0.89,l,5.0223,2026-01-26,Garrafeira Nacional
Bacalhau desfiado,1.59,kg,25.3571,2026-01-26,Peixaria do Porto
Batata,13.1,kg,1.0426,2026-01-26,Hortofrutícola Vale Verde
Batata a murro,1.46,kg,1.0656,2026-01-26,Hortofrutícola Vale Verde
Batata cozida,5.25,kg,1.1153,2026-01-26,Hortofrutícola Vale Verde
Batata frita,3.35,kg,1.1413,2026-01-26,Hortofrutícola Vale Verde
Batata palha,1.23,kg,1.3805,2026-01-26,Hortofrutícola Vale Verde
Beirão,0.25,l,24.0949,2026-01-26,Bebidas & Companhia
Bife de atum,0.58,kg,21.2511,2026-01-26,Peixaria do Porto
Bife de vaca,0.45,kg,16.3112,2026-01-26,Talho Central
Bolo de chocolate,0.58,kg,7.3934,2026-01-26,Mercearia Atlântico
CRF-Reserva,0.09,l,28.7523,2026-01-26,Bebidas & Companhia
Café moído,1.11,kg,21.6078,2026-01-26,Mercearia Atlântico
Camarão,0.18,kg,19.2389,2026-01-26,Peixaria do Porto
Canela,0.05,kg,18.3697,2026-01-26,Mercearia Atlântico
Cebola,0.42,kg,0.9163,2026-01-26,Hortofrutícola Vale Verde
Cenoura,0.12,kg,1.0575,2026-01-26,Hortofrutícola Vale Verde
Chocolate,0.1,kg,9.9379,2026-01-26,Mercearia Atlântico
Chouriço,0.19,kg,10.7937,2026-01-26,Talho Central
Coca-Cola,5.44,l,2.0849,2026-01-26,Distribuidora Refrescos Lda
Coentros,0.08,kg,9.2646,2026-01-26,Hortofrutícola Vale Verde
Compal Néctar,1.06,l,3.521,2026-01-26,Distribuidora Refrescos Lda
Coxa de pato,0.29,kg,12.5559,2026-01-26,Talho Central
E Quinta Ortigão,0.76,l,3.7665,2026-01-26,Garrafeira Nacional
Entrecosto de porco,1.95,kg,8.1847,2026-01-26,Talho Central
Entrecôte,1.94,kg,19.2092,2026-01-26,Talho Central
Filetes de peixe galo,15.8,kg,18.9547,2026-01-26,Peixaria do Porto
Filetes de polvo,4.54,kg,15.7573,2026-01-26,Peixaria do Porto
Fruta da época,0.18,kg,2.1889,2026-01-26,Hortofrutícola Vale Verde
Gelado,0.23,kg,6.0722,2026-01-26,Mercearia Atlântico
Ingredientes variados,2.32,kg,4.9165,2026-01-26,Mercearia Atlântico
Jameson,0.08,l,30.846,2026-01-26,Bebidas & Companhia
Legumes,1.81,kg,1.888,2026-01-26,Hortofrutícola Vale Verde
Legumes salteados,0.32,kg,1.862,2026-01-26,Hortofrutícola Vale Verde
Legumes variados,3.05,kg,1.7399,2026-01-26,Hortofrutícola Vale Verde
Limão,0.08,kg,2.4856,2026-01-26,Hortofrutícola Vale Verde
Lombo de bacalhau,2.0,kg,32.1152,2026-01-26,Peixaria do Porto
Lombo de vaca,0.54,kg,19.0052,2026-01-26,Talho Central
Manteiga,1.39,kg,6.9646,2026-01-26,Lacticínios Serra
Maçã,1.39,kg,1.8157,2026-01-26,Hortofrutícola Vale Verde
Melão,0.25,kg,1.6352,2026-01-26,Hortofrutícola Vale Verde
Mini Sagres,1.0,l,2.7705,2026-01-26,Distribuidora Refrescos Lda
Molho,0.23,l,6.2457,2026-01-26,Mercearia Atlântico
Molho de frutos vermelhos,0.07,l,5.815,2026-01-26,Mercearia Atlântico
Mostarda,0.03,kg,3.609,2026-01-26,Mercearia Atlântico
Ovos,28.0,unit,0.2368,2026-01-26,Lacticínios Serra
Peito de pato,0.57,kg,12.9873,2026-01-26,Talho Central
Peixe inteiro,1.79,kg,13.7011,2026-01-26,Peixaria do Porto
Peixe variado,2.57,kg,12.4036,2026-01-26,Peixaria do Porto
Pera,2.64,kg,2.2188,2026-01-26,Hortofrutícola Vale Verde
Picanha,1.45,kg,17.7981,2026-01-26,Talho Central
Polvo,1.3,kg,14.9862,2026-01-26,Peixaria do Porto
Posta de vaca,1.92,kg,17.1447,2026-01-26,Talho Central
Presunto,0.28,kg,22.6702,2026-01-26,Talho Central
"Pudim (leite, ovos, açúcar)",0.68,kg,4.6386,2026-01-26,Mercearia Atlântico
Pão,6.54,kg,3.5403,2026-01-26,Padaria Forno Antigo
Rabo de boi,0.49,kg,10.5115,2026-01-26,Talho Central
Rabo de boi desfiado,0.09,kg,10.4129,2026-01-26,Talho Central
Sangria 1.5L,3.66,l,5.6395,2026-01-26,Distribuidora Refrescos Lda
Saqueta de chá,2.0,unit,0.0958,2026-01-26,Mercearia Atlântico
TT Burmester meia gr.,0.46,l,2.5828,2026-01-26,Garrafeira Nacional
TT Duvalley,0.86,l,2.7822,2026-01-26,Garrafeira Nacional
TT Galhardini,2.83,l,3.2713,2026-01-26,Garrafeira Nacional
TT Monte Peceguinha,1.52,l,5.6778,2026-01-26,Garrafeira Nacional
TT Quinta da Leda,0.88,l,18.6448,2026-01-26,Garrafeira Nacional
TT Ribeiro Santo Res,1.35,l,3.2486,2026-01-26,Garrafeira Nacional
TT V.Nídeo Reserva,2.68,l,2.5728,2026-01-26,Garrafeira Nacional
Tamboril,0.23,kg,16.7622,2026-01-26,Peixaria do Porto
Tomate,1.42,kg,1.8101,2026-01-26,Hortofrutícola Vale Verde
Vinagre,0.02,l,1.7907,2026-01-26,Mercearia Atlântico
Vinho 0.5L,7.82,l,2.6645,2026-01-26,Distribuidora Refrescos Lda
Vinho 1L,6.29,l,0.7438,2026-01-26,Distribuidora Refrescos Lda
Vinho Branco da casa (copo),0.63,l,7.9141,2026-01-26,Distribuidora Refrescos Lda
Vinho Menu,2.43,l,2.571,2026-01-26,Distribuidora Refrescos Lda
Vinho Tinto da casa (copo),0.53,l,7.664,2026-01-26,Distribuidora Refrescos Lda
Vinho branco,0.1,l,2.9043,2026-01-26,Mercearia Atlântico
Vinho tinto,1.87,l,2.9433,2026-01-26,Mercearia Atlântico
Água 0.33L,0.4,l,1.4689,2026-01-26,Distribuidora Refrescos Lda
Água 0.5L,16.38,l,1.1814,2026-01-26,Distribuidora Refrescos Lda
Água c/gás,3.78,l,2.4795,2026-01-26,Distribuidora Refrescos Lda
Aguardente,0.02,l,9.8299,2026-02-02,Mercearia Atlântico
Alface,0.19,kg,1.4181,2026-02-02,Hortofrutícola Vale Verde
Alho,0.39,kg,4.5834,2026-02-02,Hortofrutícola Vale Verde
Ameijoas,2.25,kg,14.3832,2026-02-02,Peixaria do Porto
Amendoa Amarga,0.04,l,18.7363,2026-02-02,Bebidas & Companhia
Arroz,2.5,kg,1.584,2026-02-02,Mercearia Atlântico
Azeite,2.29,l,5.9079,2026-02-02,Mercearia Atlântico
Azeitonas,2.17,kg,4.9548,2026-02-02,Mercearia Atlântico
Açúcar,0.54,kg,1.1882,2026-02-02,Mercearia Atlântico
BR Duvalley,0.93,l,2.9949,2026-02-02,Garrafeira Nacional
BR GALHARDINI,0.91,l,2.354,2026-02-02,Garrafeira Nacional
BR Monte Peceguinha,0.67,l,5.6173,2026-02-02,Garrafeira Nacional
BR Ribeiro Santo Colheita,0.74,l,2.1018,2026-02-02,Garrafeira Nacional
BR Ribeiro Santo Encruzado,2.99,l,4.0346,2026-02-02,Garrafeira Nacional
BR V. Nídeo SauvignonBlanc,0.74,l,3.1705,2026-02-02,Garrafeira Nacional
BR Valle do Nídeo,0.93,l,2.2373,2026-02-02,Garrafeira Nacional
BR Vinha Grande,1.78,l,4.718,2026-02-02,Garrafeira Nacional
Bacalhau desfiado,3.5,kg,26.5464,2026-02-02,Peixaria do Porto
Batata,8.01,kg,1.0265,2026-02-02,Hortofrutícola Vale Verde
Batata a murro,0.83,kg,1.0517,2026-02-02,Hortofrutícola Vale Verde
Batata cozida,3.71,kg,1.0991,2026-02-02,Hortofrutícola Vale Verde
Batata frita,1.86,kg,1.1847,2026-02-02,Hortofrutícola Vale Verde
Batata palha,1.69,kg,1.3599,2026-02-02,Hortofrutícola Vale Verde
Bife de atum,0.58,kg,22.2641,2026-02-02,Peixaria do Porto
Café moído,0.91,kg,20.756,2026-02-02,Mercearia Atlântico
Camarão,0.3,kg,19.5366,2026-02-02,Peixaria do Porto
Camarão da costa,0.3,kg,29.3536,2026-02-02,Peixaria do Porto
Canela,0.04,kg,18.7121,2026-02-02,Mercearia Atlântico
Carne de vaca,0.26,kg,13.877,2026-02-02,Talho Central
Cebola,0.77,kg,0.984,2026-02-02,Hortofrutícola Vale Verde
Cenoura,0.12,kg,1.0789,2026-02-02,Hortofrutícola Vale Verde
Chouriço,0.44,kg,11.1947,2026-02-02,Talho Central
Coca-Cola,5.44,l,2.2475,2026-02-02,Distribuidora Refrescos Lda
Coentros,0.05,kg,9.2389,2026-02-02,Hortofrutícola Vale Verde
Compal Néctar,0.17,l,3.5669,2026-02-02,Distribuidora Refrescos Lda
Entrecosto de porco,0.78,kg,8.5791,2026-02-02,Talho Central
Entrecôte,1.7,kg,18.6278,2026-02-02,Talho Central
Filetes de peixe galo,9.96,kg,19.8876,2026-02-02,Peixaria do Porto
Filetes de polvo,4.0,kg,15.6228,2026-02-02,Peixaria do Porto
Gelado,0.11,kg,6.1512,2026-02-02,Mercearia Atlântico
Ingredientes variados,2.77,kg,4.8585,2026-02-02,Mercearia Atlântico
Legumes,1.13,kg,1.8163,2026-02-02,Hortofrutícola Vale Verde
Legumes salteados,0.32,kg,1.8898,2026-02-02,Hortofrutícola Vale Verde
Legumes variados,1.03,kg,1.8242,2026-02-02,Hortofrutícola Vale Verde
Leite,0.65,l,1.1204,2026-02-02,Lacticínios Serra
Limão,0.04,kg,2.3621,2026-02-02,Hortofrutícola Vale Verde
Lombo de bacalhau,0.4,kg,32.731,2026-02-02,Peixaria do Porto
Lombo de vaca,0.36,kg,18.311,2026-02-02,Talho Central
Manteiga,1.14,kg,7.0089,2026-02-02,Lacticínios Serra
Marisco variado,0.42,kg,16.4442,2026-02-02,Peixaria do Porto
Maçã,1.39,kg,1.7153,2026-02-02,Hortofrutícola Vale Verde
Molho,0.2,l,5.7106,2026-02-02,Mercearia Atlântico
Mostarda,0.01,kg,3.627,2026-02-02,Mercearia Atlântico
Ovos,42.0,unit,0.2502,2026-02-02,Lacticínios Serra
Pato desfiado,0.89,kg,13.5854,2026-02-02,Talho Central
Peixe inteiro,0.45,kg,14.8087,2026-02-02,Peixaria do Porto
Peixe variado,1.61,kg,11.7587,2026-02-02,Peixaria do Porto
Pera,1.51,kg,2.1971,2026-02-02,Hortofrutícola Vale Verde
Picanha,0.36,kg,17.9159,2026-02-02,Talho Central
Polvo,2.21,kg,13.739,2026-02-02,Peixaria do Porto
Posta de vaca,0.48,kg,18.7146,2026-02-02,Talho Central
"Pudim (leite, ovos, açúcar)",0.39,kg,4.9693,2026-02-02,Mercearia Atlântico
Pão,5.35,kg,3.4376,2026-02-02,Padaria Forno Antigo
Rabo de boi,0.49,kg,11.0995,2026-02-02,Talho Central
Rabo de boi desfiado,0.34,kg,10.6114,2026-02-02,Talho Central
Saqueta de chá,1.0,unit,0.094,2026-02-02,Mercearia Atlântico
TT Galhardini,1.41,l,3.0802,2026-02-02,Garrafeira Nacional
TT Ribeiro Santo Res,0.67,l,3.2509,2026-02-02,Garrafeira Nacional
TT Ribeiro Santo colheita,1.33,l,2.1217,2026-02-02,Garrafeira Nacional
TT V.Nídeo Reserva,1.79,l,2.5328,2026-02-02,Garrafeira Nacional
TT Vinha Grande,1.73,l,5.0899,2026-02-02,Garrafeira Nacional
Tamboril,0.45,kg,16.0728,2026-02-02,Peixaria do Porto
Tomate,1.3,kg,1.8421,2026-02-02,Hortofrutícola Vale Verde
Vinagre,0.01,l,1.8636,2026-02-02,Mercearia Atlântico
Vinho 0.5L,7.82,l,2.7896,2026-02-02,Distribuidora Refrescos Lda
Vinho 1L,3.78,l,0.7582,2026-02-02,Distribuidora Refrescos Lda
Vinho Branco da casa (copo),0.38,l,7.8199,2026-02-02,Distribuidora Refrescos Lda
Vinho Menu,2.7,l,2.4356,2026-02-02,Distribuidora Refrescos Lda
Vinho Tinto da casa (copo),0.53,l,8.3092,2026-02-02,Distribuidora Refrescos Lda
Vinho branco,0.12,l,2.8754,2026-02-02,Mercearia Atlântico
Vinho tinto,1.12,l,3.1457,2026-02-02,Mercearia Atlântico
Água 0.5L,14.6,l,1.116,2026-02-02,Distribuidora Refrescos Lda
Água c/gás,1.08,l,2.4624,2026-02-02,Distribuidora Refrescos Lda
Alface,0.38,kg,1.3914,2026-02-09,Hortofrutícola Vale Verde
Alho,0.43,kg,4.938,2026-02-09,Hortofrutícola Vale Verde
Aliança XO 10 anos,0.14,l,72.6494,2026-02-09,Bebidas & Companhia
Ameijoas,1.8,kg,14.6375,2026-02-09,Peixaria do Porto
Arroz,1.29,kg,1.5563,2026-02-09,Mercearia Atlântico
Azeite,2.24,l,6.1048,2026-02-09,Mercearia Atlântico
Azeitonas,1.83,kg,4.6094,2026-02-09,Mercearia Atlântico
Açúcar,0.25,kg,1.1953,2026-02-09,Mercearia Atlântico
BR Luis Pato Vinhas Velhas,0.79,l,4.1716,2026-02-09,Garrafeira Nacional
BR Planalto,0.7,l,2.3044,2026-02-09,Garrafeira Nacional
BR Ribeiro Santo Encruzado,0.75,l,3.9753,2026-02-09,Garrafeira Nacional
Bacalhau desfiado,0.95,kg,25.7202,2026-02-09,Peixaria do Porto
Batata,9.38,kg,1.0817,2026-02-09,Hortofrutícola Vale Verde
Batata a murro,1.04,kg,1.0617,2026-02-09,Hortofrutícola Vale Verde
Batata cozida,3.8,kg,1.0315,2026-02-09,Hortofrutícola Vale Verde
Batata frita,3.22,kg,1.2483,2026-02-09,Hortofrutícola Vale Verde
Batata palha,1.23,kg,1.3173,2026-02-09,Hortofrutícola Vale Verde
Beirão,0.07,l,24.8386,2026-02-09,Bebidas & Companhia
Bife de atum,0.97,kg,20.92,2026-02-09,Peixaria do Porto
Bife de vaca,0.3,kg,17.2714,2026-02-09,Talho Central
CRF-Reserva,0.05,l,29.794,2026-02-09,Bebidas & Companhia
Café moído,0.7,kg,20.7401,2026-02-09,Mercearia Atlântico
Camarão,0.18,kg,18.2491,2026-02-09,Peixaria do Porto
Canela,0.02,kg,18.3808,2026-02-09,Mercearia Atlântico
Cebola,0.39,kg,0.943,2026-02-09,Hortofrutícola Vale Verde
Cenoura,0.04,kg,1.1323,2026-02-09,Hortofrutícola Vale Verde
Chouriço,0.05,kg,11.3343,2026-02-09,Talho Central
Coca-Cola,3.62,l,2.1672,2026-02-09,Distribuidora Refrescos Lda
Coentros,0.05,kg,9.6122,2026-02-09,Hortofrutícola Vale Verde
Compal Néctar,0.34,l,3.7549,2026-02-09,Distribuidora Refrescos Lda
Coxa de pato,0.87,kg,12.424,2026-02-09,Talho Central
E S.Domingos,0.79,l,3.6393,2026-02-09,Garrafeira Nacional
Entrecosto de porco,1.56,kg,8.5285,2026-02-09,Talho Central
Entrecôte,2.42,kg,18.7124,2026-02-09,Talho Central
Filetes de peixe galo,10.65,kg,19.1138,2026-02-09,Peixaria do Porto
Filetes de polvo,4.32,kg,15.3076,2026-02-09,Peixaria do Porto
Gelado,0.34,kg,6.0044,2026-02-09,Mercearia Atlântico
Gin Paragon,0.17,l,13.9881,2026-02-09,Bebidas & Companhia
Ingredientes variados,2.77,kg,4.5797,2026-02-09,Mercearia Atlântico
Legumes,0.79,kg,1.7102,2026-02-09,Hortofrutícola Vale Verde
Legumes salteados,0.53,kg,1.8112,2026-02-09,Hortofrutícola Vale Verde
Legumes variados,0.51,kg,1.7327,2026-02-09,Hortofrutícola Vale Verde
Limão,0.01,kg,2.3562,2026-02-09,Hortofrutícola Vale Verde
Lombo de bacalhau,1.2,kg,32.6869,2026-02-09,Peixaria do Porto
Lombo de vaca,0.54,kg,19.8041,2026-02-09,Talho Central
Manteiga,1.03,kg,7.531,2026-02-09,Lacticínios Serra
Marisco,0.16,kg,17.3027,2026-02-09,Peixaria do Porto
Maçã,0.17,kg,1.7187,2026-02-09,Hortofrutícola Vale Verde
Mini Sagres,0.25,l,2.7534,2026-02-09,Distribuidora Refrescos Lda
Molho,0.28,l,5.7393,2026-02-09,Mercearia Atlântico
Molho de frutos vermelhos,0.1,l,5.9307,2026-02-09,Mercearia Atlântico
Mostarda,0.02,kg,3.7228,2026-02-09,Mercearia Atlântico
Ovos,28.0,unit,0.2444,2026-02-09,Lacticínios Serra
Pato desfiado,0.18,kg,13.1187,2026-02-09,Talho Central
Peito de pato,0.85,kg,12.6873,2026-02-09,Talho Central
Peixe inteiro,0.45,kg,14.2762,2026-02-09,Peixaria do Porto
Peixe variado,1.5,kg,12.4353,2026-02-09,Peixaria do Porto
Pera,1.32,kg,2.0622,2026-02-09,Hortofrutícola Vale Verde
Picanha,1.09,kg,18.2144,2026-02-09,Talho Central
Pimento,0.06,kg,2.4242,2026-02-09,Hortofrutícola Vale Verde
Polvo,1.3,kg,14.0549,2026-02-09,Peixaria do Porto
Polvo cozido,0.23,kg,14.6997,2026-02-09,Peixaria do Porto
Porto 10 anos Tawny,0.03,l,56.1061,2026-02-09,Bebidas & Companhia
Presunto,0.38,kg,20.845,2026-02-09,Talho Central
"Pudim (leite, ovos, açúcar)",1.07,kg,4.8951,2026-02-09,Mercearia Atlântico
Pão,5.07,kg,3.4329,2026-02-09,Padaria Forno Antigo
Rabo de boi,0.16,kg,10.9117,2026-02-09,Talho Central
Rabo de boi desfiado,0.43,kg,10.7887,2026-02-09,Talho Central
Sangria 1.5L,5.49,l,5.6678,2026-02-09,Distribuidora Refrescos Lda
Sangria 1L,1.01,l,5.814,2026-02-09,Distribuidora Refrescos Lda
Seven Up,0.31,l,2.1179,2026-02-09,Distribuidora Refrescos Lda
TT Duvalley Reserva,0.73,l,6.4806,2026-02-09,Garrafeira Nacional
TT Monte Peceguinha,2.28,l,5.7933,2026-02-09,Garrafeira Nacional
TT Papa Figos,0.82,l,3.1438,2026-02-09,Garrafeira Nacional
TT Ribeiro Santo Res,1.35,l,3.0207,2026-02-09,Garrafeira Nacional
TT V.Nídeo Reserva,0.89,l,2.6086,2026-02-09,Garrafeira Nacional
TT Vinha Grande,0.87,l,4.7072,2026-02-09,Garrafeira Nacional
Tamboril,0.23,kg,16.5674,2026-02-09,Peixaria do Porto
Tomate,1.06,kg,1.8015,2026-02-09,Hortofrutícola Vale Verde
V Muralhas,0.9,l,1.9779,2026-02-09,Garrafeira Nacional
Vinagre,0.03,l,1.8491,2026-02-09,Mercearia Atlântico
Vinho 0.5L,6.52,l,2.6254,2026-02-09,Distribuidora Refrescos Lda
Vinho 1L,6.29,l,0.7549,2026-02-09,Distribuidora Refrescos Lda
Vinho Branco da casa (copo),0.76,l,7.6885,2026-02-09,Distribuidora Refrescos Lda
Vinho Tinto da casa (copo),0.35,l,8.0961,2026-02-09,Distribuidora Refrescos Lda
Vinho branco,0.04,l,2.9149,2026-02-09,Mercearia Atlântico
Vinho tinto,0.92,l,2.8915,2026-02-09,Mercearia Atlântico
Água 0.5L,15.61,l,1.1398,2026-02-09,Distribuidora Refrescos Lda
Água c/gás,2.16,l,2.4543,2026-02-09,Distribuidora Refrescos Lda
Alface,0.19,kg,1.4248,2026-02-16,Hortofrutícola Vale Verde
Alheira,0.12,kg,9.1634,2026-02-16,Talho Central
Alho,0.71,kg,4.5619,2026-02-16,Hortofrutícola Vale Verde
Ameijoas,6.07,kg,14.6885,2026-02-16,Peixaria do Porto
Amendoa Amarga,0.04,l,18.7151,2026-02-16,Bebidas & Companhia
Arroz,3.2,kg,1.5656,2026-02-16,Mercearia Atlântico
Azeite,4.42,l,6.2959,2026-02-16,Mercearia Atlântico
Azeitonas,2.53,kg,4.7502,2026-02-16,Mercearia Atlântico
Açúcar,0.84,kg,1.1655,2026-02-16,Mercearia Atlântico
BR Dona Matilde,2.42,l,3.9045,2026-02-16,Garrafeira Nacional
BR Luis Pato Maria Gomes,0.78,l,2.6065,2026-02-16,Garrafeira Nacional
BR Luis Pato Vinhas Velhas,0.79,l,4.3815,2026-02-16,Garrafeira Nacional
BR Qta Portal Moscatel,0.96,l,3.9237,2026-02-16,Garrafeira Nacional
BR Ribeiro Santo Encruzado,2.99,l,4.2002,2026-02-16,Garrafeira Nacional
BR Valle do Nídeo,0.93,l,2.1855,2026-02-16,Garrafeira Nacional
BR Vinha Grande,0.89,l,5.1485,2026-02-16,Garrafeira Nacional
Bacalhau desfiado,2.54,kg,25.7497,2026-02-16,Peixaria do Porto
Batata,20.22,kg,1.0476,2026-02-16,Hortofrutícola Vale Verde
Batata a murro,0.83,kg,1.1044,2026-02-16,Hortofrutícola Vale Verde
Batata cozida,6.25,kg,1.0687,2026-02-16,Hortofrutícola Vale Verde
Batata frita,2.91,kg,1.1579,2026-02-16,Hortofrutícola Vale Verde
Batata palha,2.0,kg,1.3346,2026-02-16,Hortofrutícola Vale Verde
Bife de atum,0.58,kg,21.7446,2026-02-16,Peixaria do Porto
Black Label,0.34,l,50.3204,2026-02-16,Bebidas & Companhia
Bolo de chocolate,0.58,kg,6.9573,2026-02-16,Mercearia Atlântico
CRF-Reserva,0.09,l,29.7578,2026-02-16,Bebidas & Companhia
Café moído,1.0,kg,21.6315,2026-02-16,Mercearia Atlântico
Camarão,1.61,kg,19.8456,2026-02-16,Peixaria do Porto
Canela,0.07,kg,17.9456,2026-02-16,Mercearia Atlântico
Carne de vaca,0.26,kg,14.7158,2026-02-16,Talho Central
Cebola,0.72,kg,0.9382,2026-02-16,Hortofrutícola Vale Verde
Cenoura,0.28,kg,1.0902,2026-02-16,Hortofrutícola Vale Verde
Chocolate,0.1,kg,9.7772,2026-02-16,Mercearia Atlântico
Coca-Cola,6.95,l,2.2464,2026-02-16,Distribuidora Refrescos Lda
Coentros,0.12,kg,9.1359,2026-02-16,Hortofrutícola Vale Verde
Compal Néctar,0.34,l,3.4283,2026-02-16,Distribuidora Refrescos Lda
Conquilhas,0.17,kg,11.6229,2026-02-16,Peixaria do Porto
Coxa de pato,0.58,kg,12.183,2026-02-16,Talho Central
Entrecosto de porco,2.14,kg,8.6046,2026-02-16,Talho Central
Entrecôte,1.94,kg,19.5506,2026-02-16,Talho Central
Filetes de peixe galo,23.93,kg,18.5826,2026-02-16,Peixaria do Porto
Filetes de polvo,5.72,kg,16.16,2026-02-16,Peixaria do Porto
Gelado,0.11,kg,6.226,2026-02-16,Mercearia Atlântico
Ingredientes variados,3.32,kg,4.6052,2026-02-16,Mercearia Atlântico
Legumes,2.94,kg,1.8126,2026-02-16,Hortofrutícola Vale Verde
Legumes salteados,0.32,kg,1.8465,2026-02-16,Hortofrutícola Vale Verde
Legumes variados,1.79,kg,1.8819,2026-02-16,Hortofrutícola Vale Verde
Limão,0.15,kg,2.3105,2026-02-16,Hortofrutícola Vale Verde
Lombo de bacalhau,1.6,kg,34.1968,2026-02-16,Peixaria do Porto
Lombo de vaca,0.54,kg,18.9967,2026-02-16,Talho Central
Malagueta,0.01,kg,6.849,2026-02-16,Hortofrutícola Vale Verde
Manteiga,1.38,kg,7.1337,2026-02-16,Lacticínios Serra
Maçã,2.44,kg,1.8743,2026-02-16,Hortofrutícola Vale Verde
Mini Sagres,2.24,l,2.8863,2026-02-16,Distribuidora Refrescos Lda
Molho,0.23,l,6.2769,2026-02-16,Mercearia Atlântico
Molho de frutos vermelhos,0.14,l,5.9263,2026-02-16,Mercearia Atlântico
Mostarda,0.01,kg,3.7395,2026-02-16,Mercearia Atlântico
Ovo,1.0,unit,0.2341,2026-02-16,Lacticínios Serra
Ovos,59.0,unit,0.2413,2026-02-16,Lacticínios Serra
Peito de pato,1.14,kg,13.8326,2026-02-16,Talho Central
Peixe inteiro,2.69,kg,14.9611,2026-02-16,Peixaria do Porto
Peixe variado,4.18,kg,12.3396,2026-02-16,Peixaria do Porto
Pera,3.4,kg,2.2417,2026-02-16,Hortofrutícola Vale Verde
Picanha,0.36,kg,17.7823,2026-02-16,Talho Central
Polvo,0.78,kg,14.9477,2026-02-16,Peixaria do Porto
Polvo cozido,0.23,kg,14.4245,2026-02-16,Peixaria do Porto
Porto 10 anos Tawny,0.03,l,53.1332,2026-02-16,Bebidas & Companhia
Posta de vaca,0.96,kg,17.6306,2026-02-16,Talho Central
Presunto,0.38,kg,22.1043,2026-02-16,Talho Central
"Pudim (leite, ovos, açúcar)",1.46,kg,4.9109,2026-02-16,Mercearia Atlântico
Pão,6.66,kg,3.6073,2026-02-16,Padaria Forno Antigo
Rabo de boi,1.15,kg,10.3146,2026-02-16,Talho Central
Rabo de boi desfiado,0.68,kg,11.2363,2026-02-16,Talho Central
Sangria 1.5L,1.83,l,5.5841,2026-02-16,Distribuidora Refrescos Lda
Saqueta de chá,1.0,unit,0.0925,2026-02-16,Mercearia Atlântico
Seven Up,1.23,l,2.1424,2026-02-16,Distribuidora Refrescos Lda
TT Duvalley Reserva,1.47,l,6.7931,2026-02-16,Garrafeira Nacional
TT Galhardini,1.41,l,3.154,2026-02-16,Garrafeira Nacional
TT Monte Peceguinha,6.08,l,5.3732,2026-02-16,Garrafeira Nacional
TT Qta Portal Colheita,0.65,l,4.073,2026-02-16,Garrafeira Nacional
TT Ribeiro Santo Res,0.67,l,3.0223,2026-02-16,Garrafeira Nacional
TT V.Nídeo Reserva,0.89,l,2.6706,2026-02-16,Garrafeira Nacional
TT Vinha Grande,0.87,l,4.8507,2026-02-16,Garrafeira Nacional
Tamboril,2.49,kg,17.0749,2026-02-16,Peixaria do Porto
Tomate,2.77,kg,1.8219,2026-02-16,Hortofrutícola Vale Verde
Vinagre,0.02,l,1.8435,2026-02-16,Mercearia Atlântico
Vinho 0.5L,10.43,l,2.7763,2026-02-16,Distribuidora Refrescos Lda
Vinho 1L,8.81,l,0.781,2026-02-16,Distribuidora Refrescos Lda
Vinho Branco da casa (copo),1.38,l,7.7574,2026-02-16,Distribuidora Refrescos Lda
Vinho Menu,2.1,l,2.497,2026-02-16,Distribuidora Refrescos Lda
Vinho Tinto da casa (copo),0.7,l,8.3048,2026-02-16,Distribuidora Refrescos Lda
Vinho branco,0.28,l,3.0254,2026-02-16,Mercearia Atlântico
Vinho tinto,2.53,l,2.9384,2026-02-16,Mercearia Atlântico
Água 0.5L,22.66,l,1.1059,2026-02-16,Distribuidora Refrescos Lda
Água c/gás,4.32,l,2.4222,2026-02-16,Distribuidora Refrescos Lda
Alface,0.28,kg,1.4824,2026-02-23,Hortofrutícola Vale Verde
Alho,0.61,kg,4.9248,2026-02-23,Hortofrutícola Vale Verde
Ameijoas,3.37,kg,13.4689,2026-02-23,Peixaria do Porto
Arroz,3.3,kg,1.6227,2026-02-23,Mercearia Atlântico
Azeite,3.36,l,6.0317,2026-02-23,Mercearia Atlântico
Azeitonas,2.6,kg,4.7021,2026-02-23,Mercearia Atlântico
Açúcar,1.28,kg,1.2579,2026-02-23,Mercearia Atlântico
BR Monte Peceguinha,2.02,l,5.4564,2026-02-23,Garrafeira Nacional
BR Papa Figos,0.81,l,3.176,2026-02-23,Garrafeira Nacional
BR Piano Moscatel Galego,0.74,l,2.2849,2026-02-23,Garrafeira Nacional
BR Ribeiro Santo Encruzado,2.99,l,3.9113,2026-02-23,Garrafeira Nacional
BR Valle do Nídeo,2.78,l,2.2593,2026-02-23,Garrafeira Nacional
BR Volupia,0.75,l,3.4322,2026-02-23,Garrafeira Nacional
Bacalhau desfiado,2.54,kg,27.3291,2026-02-23,Peixaria do Porto
Batata,12.51,kg,1.0454,2026-02-23,Hortofrutícola Vale Verde
Batata a murro,1.66,kg,1.0434,2026-02-23,Hortofrutícola Vale Verde
Batata cozida,5.07,kg,1.1205,2026-02-23,Hortofrutícola Vale Verde
Batata frita,3.3,kg,1.1886,2026-02-23,Hortofrutícola Vale Verde
Batata palha,1.54,kg,1.3311,2026-02-23,Hortofrutícola Vale Verde
Beirão,0.21,l,23.9066,2026-02-23,Bebidas & Companhia
Bife de atum,1.17,kg,22.1219,2026-02-23,Peixaria do Porto
Bife de vaca,0.15,kg,16.9817,2026-02-23,Talho Central
Bolo de chocolate,0.68,kg,7.1378,2026-02-23,Mercearia Atlântico
CRF-Reserva,0.18,l,30.4799,2026-02-23,Bebidas & Companhia
Café moído,1.2,kg,22.1883,2026-02-23,Mercearia Atlântico
Camarão,0.62,kg,18.5574,2026-02-23,Peixaria do Porto
Canela,0.09,kg,18.8154,2026-02-23,Mercearia Atlântico
Cebola,1.02,kg,0.9412,2026-02-23,Hortofrutícola Vale Verde
Cenoura,0.44,kg,1.1173,2026-02-23,Hortofrutícola Vale Verde
Chocolate,0.12,kg,9.5519,2026-02-23,Mercearia Atlântico
Coca-Cola,3.32,l,2.1061,2026-02-23,Distribuidora Refrescos Lda
Coentros,0.06,kg,9.9803,2026-02-23,Hortofrutícola Vale Verde
Compal Néctar,0.34,l,3.4948,2026-02-23,Distribuidora Refrescos Lda
Coxa de pato,0.29,kg,12.4158,2026-02-23,Talho Central
E Quinta Ortigão,1.52,l,3.9308,2026-02-23,Garrafeira Nacional
ES S. Domingos Extra Reserva,2.43,l,3.6245,2026-02-23,Garrafeira Nacional
Entrecosto de porco,0.97,kg,8.7709,2026-02-23,Talho Central
Entrecôte,2.42,kg,20.0077,2026-02-23,Talho Central
Filetes de peixe galo,15.34,kg,19.6037,2026-02-23,Peixaria do Porto
Filetes de polvo,5.18,kg,16.1481,2026-02-23,Peixaria do Porto
Fruta da época,0.35,kg,2.1067,2026-02-23,Hortofrutícola Vale Verde
Gelado,0.46,kg,5.975,2026-02-23,Mercearia Atlântico
Ingredientes variados,2.99,kg,4.6777,2026-02-23,Mercearia Atlântico
Legumes,1.58,kg,1.8057,2026-02-23,Hortofrutícola Vale Verde
Legumes salteados,0.63,kg,1.7944,2026-02-23,Hortofrutícola Vale Verde
Legumes variados,1.79,kg,1.8452,2026-02-23,Hortofrutícola Vale Verde
Leite,1.74,l,1.1323,2026-02-23,Lacticínios Serra
Limão,0.05,kg,2.3193,2026-02-23,Hortofrutícola Vale Verde
Lombo de bacalhau,2.0,kg,33.7828,2026-02-23,Peixaria do Porto
Lombo de vaca,1.08,kg,18.9528,2026-02-23,Talho Central
Malagueta,0.01,kg,6.9889,2026-02-23,Hortofrutícola Vale Verde
Manteiga,1.43,kg,7.0305,2026-02-23,Lacticínios Serra
Maçã,2.26,kg,1.7547,2026-02-23,Hortofrutícola Vale Verde
Mini Sagres,3.24,l,2.7447,2026-02-23,Distribuidora Refrescos Lda
Molho,0.28,l,5.9048,2026-02-23,Mercearia Atlântico
Molho de frutos vermelhos,0.07,l,6.0185,2026-02-23,Mercearia Atlântico
Mostarda,0.01,kg,3.5874,2026-02-23,Mercearia Atlântico
Nordés,0.1,l,53.4218,2026-02-23,Bebidas & Companhia
Ovos,38.0,unit,0.2456,2026-02-23,Lacticínios Serra
Peito de pato,0.57,kg,12.9879,2026-02-23,Talho Central
Peixe variado,2.25,kg,11.8805,2026-02-23,Peixaria do Porto
Pera,3.96,kg,2.0628,2026-02-23,Hortofrutícola Vale Verde
Picanha,1.09,kg,17.5406,2026-02-23,Talho Central
Polvo,2.21,kg,13.7834,2026-02-23,Peixaria do Porto
Polvo cozido,1.15,kg,13.8513,2026-02-23,Peixaria do Porto
Posta de vaca,1.92,kg,17.7163,2026-02-23,Talho Central
Presunto,0.15,kg,22.6657,2026-02-23,Talho Central
"Pudim (leite, ovos, açúcar)",1.37,kg,5.0112,2026-02-23,Mercearia Atlântico
Pão,6.64,kg,3.4561,2026-02-23,Padaria Forno Antigo
Rabo de boi,1.8,kg,10.3647,2026-02-23,Talho Central
Rabo de boi desfiado,0.26,kg,10.4622,2026-02-23,Talho Central
Salsa,0.02,kg,9.4287,2026-02-23,Hortofrutícola Vale Verde
Sangria 1.5L,5.49,l,5.5068,2026-02-23,Distribuidora Refrescos Lda
Sangria 1L,2.02,l,5.9835,2026-02-23,Distribuidora Refrescos Lda
Seven Up,0.31,l,2.28,2026-02-23,Distribuidora Refrescos Lda
TT Duvalley,0.86,l,2.7669,2026-02-23,Garrafeira Nacional
TT Galhardini,1.41,l,3.0947,2026-02-23,Garrafeira Nacional
TT Papa Figos,1.65,l,3.2465,2026-02-23,Garrafeira Nacional
TT Ribeiro Santo colheita,0.67,l,2.0509,2026-02-23,Garrafeira Nacional
TT Titular Reserva,0.96,l,4.9921,2026-02-23,Garrafeira Nacional
TT V.Nídeo Reserva,5.37,l,2.5948,2026-02-23,Garrafeira Nacional
TT Vinha Grande,0.87,l,5.0014,2026-02-23,Garrafeira Nacional
Tamboril,0.68,kg,16.8712,2026-02-23,Peixaria do Porto
Tomate,1.59,kg,1.7348,2026-02-23,Hortofrutícola Vale Verde
Vinagre,0.07,l,1.875,2026-02-23,Mercearia Atlântico
Vinho 0.5L,4.78,l,2.6831,2026-02-23,Distribuidora Refrescos Lda
Vinho 1L,5.03,l,0.7577,2026-02-23,Distribuidora Refrescos Lda
Vinho Branco da casa (copo),0.88,l,8.0238,2026-02-23,Distribuidora Refrescos Lda
Vinho Menu,1.8,l,2.6515,2026-02-23,Distribuidora Refrescos Lda
Vinho Tinto da casa (copo),0.53,l,8.0293,2026-02-23,Distribuidora Refrescos Lda
Vinho branco,0.16,l,3.136,2026-02-23,Mercearia Atlântico
Vinho tinto,3.06,l,3.035,2026-02-23,Mercearia Atlântico
Whisky Novo,0.04,l,23.1016,2026-02-23,Bebidas & Companhia
Água 0.5L,16.11,l,1.2041,2026-02-23,Distribuidora Refrescos Lda
Água c/gás,5.13,l,2.4915,2026-02-23,Distribuidora Refrescos Lda
Alho,0.69,kg,4.9055,2026-03-02,Hortofrutícola Vale Verde
Ameijoas,1.57,kg,14.2059,2026-03-02,Peixaria do Porto
Arroz,1.57,kg,1.5096,2026-03-02,Mercearia Atlântico
Azeite,3.22,l,6.2951,2026-03-02,Mercearia Atlântico
Azeitonas,2.32,kg,4.7358,2026-03-02,Mercearia Atlântico
Açúcar,0.95,kg,1.2415,2026-03-02,Mercearia Atlântico
BR Duvalley,1.85,l,2.8218,2026-03-02,Garrafeira Nacional
BR Duvalley Reserva,0.9,l,4.4066,2026-03-02,Garrafeira Nacional
BR Luis Pato Maria Gomes,1.56,l,2.8199,2026-03-02,Garrafeira Nacional
BR Luis Pato Vinhas Velhas,0.79,l,4.4872,2026-03-02,Garrafeira Nacional
BR Papa Figos,0.81,l,3.2057,2026-03-02,Garrafeira Nacional
BR Qta Portal Moscatel,0.96,l,3.8862,2026-03-02,Garrafeira Nacional
BR Ribeiro Santo Encruzado,2.24,l,4.0083,2026-03-02,Garrafeira Nacional
Bacalhau desfiado,1.59,kg,26.4829,2026-03-02,Peixaria do Porto
Batata,11.2,kg,1.1058,2026-03-02,Hortofrutícola Vale Verde
Batata a murro,1.87,kg,1.0621,2026-03-02,Hortofrutícola Vale Verde
Batata cozida,7.42,kg,1.0976,2026-03-02,Hortofrutícola Vale Verde
Batata frita,2.35,kg,1.2074,2026-03-02,Hortofrutícola Vale Verde
Batata palha,1.08,kg,1.3411,2026-03-02,Hortofrutícola Vale Verde
Beirão,0.07,l,24.6584,2026-03-02,Bebidas & Companhia
Bife de atum,1.17,kg,21.0475,2026-03-02,Peixaria do Porto
Bife de vaca,0.3,kg,16.1929,2026-03-02,Talho Central
Bolo de chocolate,0.19,kg,7.4472,2026-03-02,Mercearia Atlântico
CRF-Reserva,0.09,l,30.0268,2026-03-02,Bebidas & Companhia
Café moído,1.3,kg,22.4793,2026-03-02,Mercearia Atlântico
Camarão,0.5,kg,19.9536,2026-03-02,Peixaria do Porto
Canela,0.07,kg,17.1725,2026-03-02,Mercearia Atlântico
Carne de vaca,0.26,kg,13.9573,2026-03-02,Talho Central
Cebola,0.24,kg,1.003,2026-03-02,Hortofrutícola Vale Verde
Chocolate,0.03,kg,10.0591,2026-03-02,Mercearia Atlântico
Coca-Cola,6.34,l,2.1618,2026-03-02,Distribuidora Refrescos Lda
Coentros,0.03,kg,9.4487,2026-03-02,Hortofrutícola Vale Verde
Compal Néctar,0.17,l,3.5784,2026-03-02,Distribuidora Refrescos Lda
ES Ortigão Nektar,0.69,l,2.523,2026-03-02,Garrafeira Nacional
Entrecosto de porco,0.58,kg,8.3322,2026-03-02,Talho Central
Entrecôte,0.73,kg,19.9202,2026-03-02,Talho Central
Filetes de peixe galo,13.28,kg,18.867,2026-03-02,Peixaria do Porto
Filetes de polvo,6.91,kg,15.1286,2026-03-02,Peixaria do Porto
Fruta da época,0.35,kg,2.1406,2026-03-02,Hortofrutícola Vale Verde
Ingredientes variados,2.77,kg,4.8804,2026-03-02,Mercearia Atlântico
Legumes,1.24,kg,1.8637,2026-03-02,Hortofrutícola Vale Verde
Legumes salteados,0.63,kg,1.8743,2026-03-02,Hortofrutícola Vale Verde
Legumes variados,2.02,kg,1.8739,2026-03-02,Hortofrutícola Vale Verde
Leite,1.52,l,1.0992,2026-03-02,Lacticínios Serra
Limão,0.08,kg,2.2847,2026-03-02,Hortofrutícola Vale Verde
Lombo de bacalhau,1.2,kg,34.0442,2026-03-02,Peixaria do Porto
Lombo de vaca,1.62,kg,19.014,2026-03-02,Talho Central
Manteiga,1.29,kg,6.906,2026-03-02,Lacticínios Serra
Martini,0.09,l,18.8975,2026-03-02,Bebidas & Companhia
Maçã,2.44,kg,1.7544,2026-03-02,Hortofrutícola Vale Verde
Melão,0.5,kg,1.557,2026-03-02,Hortofrutícola Vale Verde
Molho,0.09,l,6.0661,2026-03-02,Mercearia Atlântico
Molho de frutos vermelhos,0.07,l,6.2164,2026-03-02,Mercearia Atlântico
Mostarda,0.03,kg,3.5221,2026-03-02,Mercearia Atlântico
Ovos,24.0,unit,0.2353,2026-03-02,Lacticínios Serra
Peito de pato,0.57,kg,13.5672,2026-03-02,Talho Central
Peixe inteiro,2.24,kg,14.6239,2026-03-02,Peixaria do Porto
Peixe variado,1.77,kg,12.5231,2026-03-02,Peixaria do Porto
Pera,2.26,kg,2.0799,2026-03-02,Hortofrutícola Vale Verde
Picanha,0.72,kg,17.8991,2026-03-02,Talho Central
Polvo,2.6,kg,13.7134,2026-03-02,Peixaria do Porto
Posta de vaca,1.92,kg,17.9216,2026-03-02,Talho Central
Presunto,0.26,kg,21.9626,2026-03-02,Talho Central
"Pudim (leite, ovos, açúcar)",0.98,kg,4.8839,2026-03-02,Mercearia Atlântico
Pão,6.54,kg,3.4653,2026-03-02,Padaria Forno Antigo
Rabo de boi desfiado,0.86,kg,10.5355,2026-03-02,Talho Central
Saqueta de chá,5.0,unit,0.1001,2026-03-02,Mercearia Atlântico
Seven Up,0.31,l,2.1063,2026-03-02,Distribuidora Refrescos Lda
TT Dona Matilde,0.89,l,3.8847,2026-03-02,Garrafeira Nacional
TT Dona Matilde Res,1.82,l,8.7438,2026-03-02,Garrafeira Nacional
TT Duvalley,0.86,l,2.6672,2026-03-02,Garrafeira Nacional
TT Galhardini,0.71,l,3.1077,2026-03-02,Garrafeira Nacional
TT Monte Peceguinha,0.76,l,5.7712,2026-03-02,Garrafeira Nacional
TT Quinta da Leda,1.76,l,19.4282,2026-03-02,Garrafeira Nacional
TT Ribeiro Santo colheita,1.33,l,2.1705,2026-03-02,Garrafeira Nacional
TT V.Nídeo Reserva,1.79,l,2.6515,2026-03-02,Garrafeira Nacional
TT Vinha Grande,1.73,l,4.92,2026-03-02,Garrafeira Nacional
Tamboril,1.13,kg,16.7154,2026-03-02,Peixaria do Porto
Tomate,1.11,kg,1.8449,2026-03-02,Hortofrutícola Vale Verde
V Muralhas,0.9,l,1.9806,2026-03-02,Garrafeira Nacional
Vinho 0.5L,8.25,l,2.712,2026-03-02,Distribuidora Refrescos Lda
Vinho 1L,3.78,l,0.74,2026-03-02,Distribuidora Refrescos Lda
Vinho Branco da casa (copo),1.51,l,8.0688,2026-03-02,Distribuidora Refrescos Lda
Vinho Menu,6.29,l,2.5393,2026-03-02,Distribuidora Refrescos Lda
Vinho Tinto da casa (copo),1.41,l,7.8564,2026-03-02,Distribuidora Refrescos Lda
Vinho branco,0.09,l,3.0556,2026-03-02,Mercearia Atlântico
Vinho tinto,1.51,l,2.9325,2026-03-02,Mercearia Atlântico
Água 0.33L,0.4,l,1.4531,2026-03-02,Distribuidora Refrescos Lda
Água 0.5L,16.11,l,1.2068,2026-03-02,Distribuidora Refrescos Lda
Água Ardente,0.05,l,29.0031,2026-03-02,Bebidas & Companhia
Água c/gás,2.43,l,2.471,2026-03-02,Distribuidora Refrescos Lda
Aguardente,0.05,l,9.2025,2026-03-09,Mercearia Atlântico
Alface,0.28,kg,1.4795,2026-03-09,Hortofrutícola Vale Verde
Alho,0.47,kg,4.9094,2026-03-09,Hortofrutícola Vale Verde
Ameijoas,1.35,kg,13.9457,2026-03-09,Peixaria do Porto
Arroz,1.61,kg,1.5371,2026-03-09,Mercearia Atlântico
Azeite,2.92,l,6.1744,2026-03-09,Mercearia Atlântico
Azeitonas,1.94,kg,4.9596,2026-03-09,Mercearia Atlântico
Açúcar,0.69,kg,1.2005,2026-03-09,Mercearia Atlântico
BR Duvalley Reserva,0.9,l,4.4345,2026-03-09,Garrafeira Nacional
BR GALHARDINI,3.65,l,2.224,2026-03-09,Garrafeira Nacional
BR Luis Pato Maria Gomes,0.78,l,2.8073,2026-03-09,Garrafeira Nacional
BR Monte Peceguinha,4.71,l,5.8687,2026-03-09,Garrafeira Nacional
BR Papa Figos,0.81,l,3.3805,2026-03-09,Garrafeira Nacional
BR Ribeiro Santo Encruzado,2.24,l,4.2435,2026-03-09,Garrafeira Nacional
Bacalhau desfiado,3.5,kg,27.1957,2026-03-09,Peixaria do Porto
Batata,8.52,kg,1.1339,2026-03-09,Hortofrutícola Vale Verde
Batata a murro,2.49,kg,1.1209,2026-03-09,Hortofrutícola Vale Verde
Batata cozida,5.25,kg,1.0363,2026-03-09,Hortofrutícola Vale Verde
Batata frita,2.19,kg,1.2223,2026-03-09,Hortofrutícola Vale Verde
Batata palha,2.15,kg,1.3188,2026-03-09,Hortofrutícola Vale Verde
Bife de atum,1.36,kg,20.6704,2026-03-09,Peixaria do Porto
Bolo de chocolate,0.58,kg,6.967,2026-03-09,Mercearia Atlântico
CRF-Reserva,0.14,l,28.9116,2026-03-09,Bebidas & Companhia
Café moído,0.79,kg,21.1046,2026-03-09,Mercearia Atlântico
Camarão,0.32,kg,18.5348,2026-03-09,Peixaria do Porto
Canela,0.05,kg,18.4505,2026-03-09,Mercearia Atlântico
Cebola,0.84,kg,0.952,2026-03-09,Hortofrutícola Vale Verde
Cenoura,0.2,kg,1.1147,2026-03-09,Hortofrutícola Vale Verde
Chocolate,0.1,kg,9.5266,2026-03-09,Mercearia Atlântico
Chouriço,0.57,kg,10.3884,2026-03-09,Talho Central
Coca-Cola,4.53,l,2.2658,2026-03-09,Distribuidora Refrescos Lda
Coentros,0.03,kg,9.5278,2026-03-09,Hortofrutícola Vale Verde
Conquilhas,0.17,kg,12.345,2026-03-09,Peixaria do Porto
Coxa de pato,1.16,kg,12.0406,2026-03-09,Talho Central
Entrecosto de porco,0.39,kg,8.3114,2026-03-09,Talho Central
Entrecôte,2.18,kg,19.2015,2026-03-09,Talho Central
Filetes de peixe galo,9.39,kg,20.1447,2026-03-09,Peixaria do Porto
Filetes de polvo,3.89,kg,15.6257,2026-03-09,Peixaria do Porto
Fruta da época,0.35,kg,2.1076,2026-03-09,Hortofrutícola Vale Verde
Gelado,0.23,kg,5.8325,2026-03-09,Mercearia Atlântico
Ingredientes variados,1.22,kg,4.825,2026-03-09,Mercearia Atlântico
Legumes,1.58,kg,1.7364,2026-03-09,Hortofrutícola Vale Verde
Legumes salteados,0.74,kg,1.7348,2026-03-09,Hortofrutícola Vale Verde
Legumes variados,1.28,kg,1.8582,2026-03-09,Hortofrutícola Vale Verde
Limão,0.12,kg,2.4413,2026-03-09,Hortofrutícola Vale Verde
Lombo de bacalhau,3.2,kg,32.4035,2026-03-09,Peixaria do Porto
Lombo de vaca,0.72,kg,18.4245,2026-03-09,Talho Central
Manteiga,1.01,kg,6.9205,2026-03-09,Lacticínios Serra
Maçã,0.87,kg,1.7417,2026-03-09,Hortofrutícola Vale Verde
Mini Sagres,8.22,l,2.9242,2026-03-09,Distribuidora Refrescos Lda
Molho,0.26,l,6.0916,2026-03-09,Mercearia Atlântico
Ovos,49.0,unit,0.2494,2026-03-09,Lacticínios Serra
Peixe inteiro,4.03,kg,13.7772,2026-03-09,Peixaria do Porto
Peixe variado,2.25,kg,11.6016,2026-03-09,Peixaria do Porto
Pera,3.4,kg,2.2145,2026-03-09,Hortofrutícola Vale Verde
Picanha,0.36,kg,17.1009,2026-03-09,Talho Central
Polvo,2.6,kg,14.3083,2026-03-09,Peixaria do Porto
Polvo cozido,0.23,kg,13.9325,2026-03-09,Peixaria do Porto
Posta de vaca,0.96,kg,18.8561,2026-03-09,Talho Central
Presunto,0.23,kg,20.6341,2026-03-09,Talho Central
"Pudim (leite, ovos, açúcar)",0.68,kg,4.783,2026-03-09,Mercearia Atlântico
Pão,5.17,kg,3.6588,2026-03-09,Padaria Forno Antigo
RS Papa Figos,1.58,l,3.4795,2026-03-09,Garrafeira Nacional
Rabo de boi,0.82,kg,11.1587,2026-03-09,Talho Central
Rabo de boi desfiado,0.94,kg,11.3148,2026-03-09,Talho Central
Sangria 1.5L,1.83,l,5.4121,2026-03-09,Distribuidora Refrescos Lda
Saqueta de chá,1.0,unit,0.0983,2026-03-09,Mercearia Atlântico
Seven Up,0.31,l,2.1585,2026-03-09,Distribuidora Refrescos Lda
TT Monte Peceguinha,1.52,l,5.5205,2026-03-09,Garrafeira Nacional
TT Papa Figos,0.82,l,3.1969,2026-03-09,Garrafeira Nacional
TT Vinha Grande,1.73,l,5.042,2026-03-09,Garrafeira Nacional
Tamboril,0.23,kg,16.3101,2026-03-09,Peixaria do Porto
Tomate,1.44,kg,1.7163,2026-03-09,Hortofrutícola Vale Verde
Vinagre,0.03,l,1.8274,2026-03-09,Mercearia Atlântico
Vinho 0.5L,5.65,l,2.7649,2026-03-09,Distribuidora Refrescos Lda
Vinho 1L,3.78,l,0.7868,2026-03-09,Distribuidora Refrescos Lda
Vinho Branco da casa (copo),1.38,l,7.8547,2026-03-09,Distribuidora Refrescos Lda
Vinho Menu,2.7,l,2.5378,2026-03-09,Distribuidora Refrescos Lda
Vinho Tinto da casa (copo),0.53,l,7.7754,2026-03-09,Distribuidora Refrescos Lda
Vinho branco,0.06,l,2.8654,2026-03-09,Mercearia Atlântico
Vinho tinto,2.45,l,2.9465,2026-03-09,Mercearia Atlântico
Água 0.5L,18.63,l,1.1888,2026-03-09,Distribuidora Refrescos Lda
Água c/gás,3.24,l,2.5766,2026-03-09,Distribuidora Refrescos Lda
Alface,0.09,kg,1.4478,2026-03-16,Hortofrutícola Vale Verde
Alheira,0.12,kg,9.7278,2026-03-16,Talho Central
Alho,0.43,kg,4.6988,2026-03-16,Hortofrutícola Vale Verde
Ameijoas,2.02,kg,14.2185,2026-03-16,Peixaria do Porto
Arroz,2.33,kg,1.4861,2026-03-16,Mercearia Atlântico
Azeite,2.33,l,6.0399,2026-03-16,Mercearia Atlântico
Azeitonas,2.02,kg,4.9568,2026-03-16,Mercearia Atlântico
Açúcar,1.03,kg,1.1658,2026-03-16,Mercearia Atlântico
BR Burmester meia gr.,0.45,l,2.5702,2026-03-16,Garrafeira Nacional
BR Luis Pato Vinhas Velhas,1.58,l,4.2659,2026-03-16,Garrafeira Nacional
BR Monte Peceguinha,2.02,l,5.5867,2026-03-16,Garrafeira Nacional
BR Papa Figos,0.81,l,3.2658,2026-03-16,Garrafeira Nacional
BR Ribeiro Santo Encruzado,0.75,l,4.2228,2026-03-16,Garrafeira Nacional
Bacalhau desfiado,1.59,kg,25.7669,2026-03-16,Peixaria do Porto
Batata,9.44,kg,1.0866,2026-03-16,Hortofrutícola Vale Verde
Batata a murro,1.46,kg,1.0444,2026-03-16,Hortofrutícola Vale Verde
Batata cozida,3.8,kg,1.0446,2026-03-16,Hortofrutícola Vale Verde
Batata frita,2.39,kg,1.1725,2026-03-16,Hortofrutícola Vale Verde
Batata palha,0.92,kg,1.3093,2026-03-16,Hortofrutícola Vale Verde
Bife de atum,0.39,kg,22.6171,2026-03-16,Peixaria do Porto
Bife de vaca,0.3,kg,16.6702,2026-03-16,Talho Central
Bolo de chocolate,0.1,kg,7.0712,2026-03-16,Mercearia Atlântico
CRF-Reserva,0.09,l,29.6926,2026-03-16,Bebidas & Companhia
Café moído,0.9,kg,21.6473,2026-03-16,Mercearia Atlântico
Camarão,0.41,kg,18.8443,2026-03-16,Peixaria do Porto
Camarão da costa,0.3,kg,30.2543,2026-03-16,Peixaria do Porto
Canela,0.07,kg,18.1544,2026-03-16,Mercearia Atlântico
Cebola,0.45,kg,0.9697,2026-03-16,Hortofrutícola Vale Verde
Cenoura,0.16,kg,1.0929,2026-03-16,Hortofrutícola Vale Verde
Chocolate,0.02,kg,9.3055,2026-03-16,Mercearia Atlântico
Chouriço,0.2,kg,11.2674,2026-03-16,Talho Central
Coca-Cola,5.13,l,2.2204,2026-03-16,Distribuidora Refrescos Lda
Coentros,0.04,kg,9.8253,2026-03-16,Hortofrutícola Vale Verde
Coxa de pato,1.16,kg,11.6547,2026-03-16,Talho Central
ES Quinta Monteirinhos,0.95,l,5.4553,2026-03-16,Garrafeira Nacional
Entrecosto de porco,0.58,kg,8.2521,2026-03-16,Talho Central
Entrecôte,1.21,kg,20.0614,2026-03-16,Talho Central
Filetes de peixe galo,8.82,kg,19.9493,2026-03-16,Peixaria do Porto
Filetes de polvo,3.02,kg,15.5531,2026-03-16,Peixaria do Porto
Ingredientes variados,2.99,kg,4.9894,2026-03-16,Mercearia Atlântico
Legumes,1.13,kg,1.7677,2026-03-16,Hortofrutícola Vale Verde
Legumes salteados,0.21,kg,1.7785,2026-03-16,Hortofrutícola Vale Verde
Legumes variados,3.02,kg,1.7342,2026-03-16,Hortofrutícola Vale Verde
Leite,2.4,l,1.1219,2026-03-16,Lacticínios Serra
Limão,0.09,kg,2.4789,2026-03-16,Hortofrutícola Vale Verde
Lombo de bacalhau,1.6,kg,33.5787,2026-03-16,Peixaria do Porto
Lombo de vaca,1.08,kg,18.9799,2026-03-16,Talho Central
Malagueta,0.01,kg,7.2461,2026-03-16,Hortofrutícola Vale Verde
Manteiga,1.12,kg,6.8408,2026-03-16,Lacticínios Serra
Maçã,2.09,kg,1.7207,2026-03-16,Hortofrutícola Vale Verde
Mini Sagres,0.25,l,2.9682,2026-03-16,Distribuidora Refrescos Lda
Molho,0.14,l,6.0461,2026-03-16,Mercearia Atlântico
Molho de frutos vermelhos,0.31,l,6.2613,2026-03-16,Mercearia Atlântico
Moscatel,0.1,l,17.9313,2026-03-16,Bebidas & Companhia
Mostarda,0.02,kg,3.4834,2026-03-16,Mercearia Atlântico
Ovos,21.0,unit,0.2462,2026-03-16,Lacticínios Serra
Pato desfiado,0.71,kg,13.7633,2026-03-16,Talho Central
Peito de pato,2.56,kg,13.1684,2026-03-16,Talho Central
Peixe inteiro,2.24,kg,14.6107,2026-03-16,Peixaria do Porto
Peixe variado,1.61,kg,12.4323,2026-03-16,Peixaria do Porto
Pera,1.89,kg,2.0942,2026-03-16,Hortofrutícola Vale Verde
Picanha,1.09,kg,17.4854,2026-03-16,Talho Central
Polvo,1.69,kg,14.7032,2026-03-16,Peixaria do Porto
Polvo cozido,0.23,kg,13.8228,2026-03-16,Peixaria do Porto
Posta de vaca,0.96,kg,17.2859,2026-03-16,Talho Central
Presunto,0.08,kg,21.9429,2026-03-16,Talho Central
"Pudim (leite, ovos, açúcar)",1.27,kg,4.9535,2026-03-16,Mercearia Atlântico
Pão,5.4,kg,3.4438,2026-03-16,Padaria Forno Antigo
Rabo de boi,0.66,kg,10.3846,2026-03-16,Talho Central
Rabo de boi desfiado,0.34,kg,10.3077,2026-03-16,Talho Central
Saqueta de chá,1.0,unit,0.0924,2026-03-16,Mercearia Atlântico
Seven Up,0.31,l,2.2617,2026-03-16,Distribuidora Refrescos Lda
TT Dona Matilde,1.78,l,3.6556,2026-03-16,Garrafeira Nacional
TT Dona Matilde Res,0.91,l,8.9553,2026-03-16,Garrafeira Nacional
TT Duvalley Reserva,0.73,l,6.78,2026-03-16,Garrafeira Nacional
TT Galhardini,0.71,l,3.1199,2026-03-16,Garrafeira Nacional
TT Monte Peceguinha,2.28,l,5.8723,2026-03-16,Garrafeira Nacional
TT Papa Figos,0.82,l,3.2393,2026-03-16,Garrafeira Nacional
Tomate,0.83,kg,1.7189,2026-03-16,Hortofrutícola Vale Verde
V Muralhas,0.9,l,1.9893,2026-03-16,Garrafeira Nacional
V Regueiro,1.73,l,3.8542,2026-03-16,Garrafeira Nacional
Vinagre,0.02,l,1.7473,2026-03-16,Mercearia Atlântico
Vinho 0.5L,9.12,l,2.5593,2026-03-16,Distribuidora Refrescos Lda
Vinho 1L,2.52,l,0.7583,2026-03-16,Distribuidora Refrescos Lda
Vinho Branco da casa (copo),1.13,l,7.8859,2026-03-16,Distribuidora Refrescos Lda
Vinho Menu,2.1,l,2.4288,2026-03-16,Distribuidora Refrescos Lda
Vinho Tinto da casa (copo),1.76,l,7.8118,2026-03-16,Distribuidora Refrescos Lda
Vinho branco,0.1,l,3.0153,2026-03-16,Mercearia Atlântico
Vinho tinto,1.41,l,3.0539,2026-03-16,Mercearia Atlântico
Água 0.5L,16.11,l,1.1647,2026-03-16,Distribuidora Refrescos Lda
Água c/gás,2.7,l,2.4225,2026-03-16,Distribuidora Refrescos Lda
Aguardente,0.02,l,9.1253,2026-03-23,Mercearia Atlântico
Alface,0.21,kg,1.4882,2026-03-23,Hortofrutícola Vale Verde
Alheira,0.12,kg,9.1588,2026-03-23,Talho Central
Alho,0.79,kg,4.6054,2026-03-23,Hortofrutícola Vale Verde
Aliança XO 10 anos,0.1,l,70.8893,2026-03-23,Bebidas & Companhia
Ameijoas,5.17,kg,13.83,2026-03-23,Peixaria do Porto
Amendoa Amarga,0.04,l,18.3704,2026-03-23,Bebidas & Companhia
Arroz,2.63,kg,1.5698,2026-03-23,Mercearia Atlântico
Azeite,4.2,l,6.1339,2026-03-23,Mercearia Atlântico
Azeitonas,2.6,kg,4.8866,2026-03-23,Mercearia Atlântico
Açúcar,0.58,kg,1.1709,2026-03-23,Mercearia Atlântico
BR Luis Pato Maria Gomes,0.78,l,2.6462,2026-03-23,Garrafeira Nacional
BR Papa Figos,2.43,l,3.1508,2026-03-23,Garrafeira Nacional
BR Qta Portal Moscatel,3.84,l,4.2116,2026-03-23,Garrafeira Nacional
BR Ribeiro Santo Encruzado,4.48,l,4.0053,2026-03-23,Garrafeira Nacional
BR Vinha Grande,3.55,l,5.1311,2026-03-23,Garrafeira Nacional
BR Volupia,2.24,l,3.5404,2026-03-23,Garrafeira Nacional
Bacalhau desfiado,1.91,kg,26.6085,2026-03-23,Peixaria do Porto
Bacon,0.04,kg,9.6648,2026-03-23,Talho Central
Batata,17.78,kg,1.0796,2026-03-23,Hortofrutícola Vale Verde
Batata a murro,2.91,kg,1.1208,2026-03-23,Hortofrutícola Vale Verde
Batata cozida,6.43,kg,1.1303,2026-03-23,Hortofrutícola Vale Verde
Batata frita,4.68,kg,1.1432,2026-03-23,Hortofrutícola Vale Verde
Batata palha,1.39,kg,1.2546,2026-03-23,Hortofrutícola Vale Verde
Beirão,0.18,l,24.9672,2026-03-23,Bebidas & Companhia
Bife de atum,0.78,kg,21.3337,2026-03-23,Peixaria do Porto
Bolo de chocolate,0.68,kg,6.8689,2026-03-23,Mercearia Atlântico
Café moído,0.98,kg,22.1259,2026-03-23,Mercearia Atlântico
Camarão,1.2,kg,19.8761,2026-03-23,Peixaria do Porto
Camarão da costa,0.75,kg,29.5324,2026-03-23,Peixaria do Porto
Canela,0.04,kg,18.5882,2026-03-23,Mercearia Atlântico
Carne de vaca,0.77,kg,13.8194,2026-03-23,Talho Central
Cebola,0.64,kg,0.9762,2026-03-23,Hortofrutícola Vale Verde
Cenoura,0.08,kg,1.1312,2026-03-23,Hortofrutícola Vale Verde
Chocolate,0.12,kg,9.5633,2026-03-23,Mercearia Atlântico
Chouriço,0.19,kg,10.763,2026-03-23,Talho Central
Coca-Cola,9.06,l,2.1449,2026-03-23,Distribuidora Refrescos Lda
Coentros,0.09,kg,9.2794,2026-03-23,Hortofrutícola Vale Verde
Entrecosto de porco,0.97,kg,8.6476,2026-03-23,Talho Central
Entrecôte,6.79,kg,18.7591,2026-03-23,Talho Central
Feijão preto cozido,0.23,kg,3.1012,2026-03-23,Hortofrutícola Vale Verde
Filetes de peixe galo,21.64,kg,19.7278,2026-03-23,Peixaria do Porto
Filetes de polvo,5.94,kg,15.6569,2026-03-23,Peixaria do Porto
Frango,0.09,kg,5.6245,2026-03-23,Talho Central
Fruta da época,0.53,kg,2.0983,2026-03-23,Hortofrutícola Vale Verde
Ingredientes variados,3.21,kg,4.8312,2026-03-23,Mercearia Atlântico
J.Walker Black 12 anos,0.22,l,15.1405,2026-03-23,Bebidas & Companhia
Legumes,0.9,kg,1.7282,2026-03-23,Hortofrutícola Vale Verde
Legumes salteados,0.42,kg,1.8214,2026-03-23,Hortofrutícola Vale Verde
Legumes variados,1.0,kg,1.7143,2026-03-23,Hortofrutícola Vale Verde
Leite,0.87,l,1.1076,2026-03-23,Lacticínios Serra
Limão,0.18,kg,2.3315,2026-03-23,Hortofrutícola Vale Verde
Lombo de bacalhau,3.2,kg,34.1656,2026-03-23,Peixaria do Porto
Lombo de vaca,0.36,kg,19.3203,2026-03-23,Talho Central
Maionese,0.02,kg,3.563,2026-03-23,Mercearia Atlântico
Malagueta,0.01,kg,7.1974,2026-03-23,Hortofrutícola Vale Verde
Manteiga,1.45,kg,7.1086,2026-03-23,Lacticínios Serra
Maçã,1.39,kg,1.8834,2026-03-23,Hortofrutícola Vale Verde
Mini Sagres,1.25,l,2.7698,2026-03-23,Distribuidora Refrescos Lda
Molho,0.79,l,5.7964,2026-03-23,Mercearia Atlântico
Molho de frutos vermelhos,0.03,l,5.8706,2026-03-23,Mercearia Atlântico
Moscatel,0.05,l,17.6468,2026-03-23,Bebidas & Companhia
Mostarda,0.04,kg,3.761,2026-03-23,Mercearia Atlântico
Ovos,35.0,unit,0.2289,2026-03-23,Lacticínios Serra
Peito de pato,0.28,kg,13.6458,2026-03-23,Talho Central
Peixe inteiro,3.14,kg,14.432,2026-03-23,Peixaria do Porto
Peixe variado,1.29,kg,11.8494,2026-03-23,Peixaria do Porto
Pera,1.51,kg,2.0925,2026-03-23,Hortofrutícola Vale Verde
Polvo,4.15,kg,15.0156,2026-03-23,Peixaria do Porto
Posta de vaca,0.48,kg,17.2077,2026-03-23,Talho Central
Presunto,0.23,kg,22.3682,2026-03-23,Talho Central
"Pudim (leite, ovos, açúcar)",1.07,kg,4.9797,2026-03-23,Mercearia Atlântico
Pão,7.07,kg,3.7364,2026-03-23,Padaria Forno Antigo
Pão de forma,0.11,kg,4.2147,2026-03-23,Padaria Forno Antigo
RS Papa Figos,0.79,l,3.3306,2026-03-23,Garrafeira Nacional
Rabo de boi,0.33,kg,11.1337,2026-03-23,Talho Central
Rabo de boi desfiado,0.86,kg,10.6974,2026-03-23,Talho Central
Sangria 1L,1.01,l,5.5524,2026-03-23,Distribuidora Refrescos Lda
Saqueta de chá,2.0,unit,0.0988,2026-03-23,Mercearia Atlântico
Seven Up,0.31,l,2.1668,2026-03-23,Distribuidora Refrescos Lda
TT Dez Tostões,0.89,l,5.9351,2026-03-23,Garrafeira Nacional
TT Galhardini,0.71,l,3.2624,2026-03-23,Garrafeira Nacional
TT Monte Peceguinha,1.52,l,5.851,2026-03-23,Garrafeira Nacional
TT S. Domingos Reserva,1.79,l,3.9799,2026-03-23,Garrafeira Nacional
TT Vinha Grande,0.87,l,4.8764,2026-03-23,Garrafeira Nacional
Tamboril,1.59,kg,16.0956,2026-03-23,Peixaria do Porto
Tomate,1.7,kg,1.8175,2026-03-23,Hortofrutícola Vale Verde
V Muralhas,0.9,l,1.8393,2026-03-23,Garrafeira Nacional
Vinagre,0.01,l,1.738,2026-03-23,Mercearia Atlântico
Vinho 0.5L,6.52,l,2.7071,2026-03-23,Distribuidora Refrescos Lda
Vinho 1L,10.07,l,0.7527,2026-03-23,Distribuidora Refrescos Lda
Vinho Branco da casa (copo),1.64,l,7.9709,2026-03-23,Distribuidora Refrescos Lda
Vinho Menu,1.8,l,2.5761,2026-03-23,Distribuidora Refrescos Lda
Vinho Tinto da casa (copo),0.35,l,7.896,2026-03-23,Distribuidora Refrescos Lda
Vinho branco,0.35,l,2.9667,2026-03-23,Mercearia Atlântico
Vinho tinto,1.08,l,3.0283,2026-03-23,Mercearia Atlântico
Água 0.5L,27.19,l,1.1425,2026-03-23,Distribuidora Refrescos Lda
Água c/gás,3.24,l,2.4008,2026-03-23,Distribuidora Refrescos Lda
Aguardente,0.05,l,9.6389,2026-03-30,Mercearia Atlântico
Alface,0.38,kg,1.5029,2026-03-30,Hortofrutícola Vale Verde
Alheira,0.24,kg,9.9093,2026-03-30,Talho Central
Alho,0.81,kg,4.6209,2026-03-30,Hortofrutícola Vale Verde
Ameijoas,7.64,kg,13.939,2026-03-30,Peixaria do Porto
Amendoa Amarga,0.04,l,18.6412,2026-03-30,Bebidas & Companhia
Arroz,5.36,kg,1.5514,2026-03-30,Mercearia Atlântico
Azeite,4.78,l,6.198,2026-03-30,Mercearia Atlântico
Azeitonas,2.79,kg,5.0284,2026-03-30,Mercearia Atlântico
Açúcar,0.65,kg,1.2563,2026-03-30,Mercearia Atlântico
BR Burmester meia gr.,0.45,l,2.6369,2026-03-30,Garrafeira Nacional
BR Monte Peceguinha,3.36,l,5.3431,2026-03-30,Garrafeira Nacional
BR Papa Figos,1.62,l,3.2939,2026-03-30,Garrafeira Nacional
BR Piano Moscatel Galego,1.47,l,2.165,2026-03-30,Garrafeira Nacional
BR Ribeiro Santo Colheita,2.94,l,2.248,2026-03-30,Garrafeira Nacional
BR Ribeiro Santo Encruzado,3.73,l,3.9622,2026-03-30,Garrafeira Nacional
BR Volupia,0.75,l,3.557,2026-03-30,Garrafeira Nacional
Bacalhau desfiado,1.27,kg,27.6259,2026-03-30,Peixaria do Porto
Batata,14.95,kg,1.1119,2026-03-30,Hortofrutícola Vale Verde
Batata a murro,4.57,kg,1.1279,2026-03-30,Hortofrutícola Vale Verde
Batata cozida,4.62,kg,1.043,2026-03-30,Hortofrutícola Vale Verde
Batata frita,6.22,kg,1.1864,2026-03-30,Hortofrutícola Vale Verde
Batata palha,1.23,kg,1.2664,2026-03-30,Hortofrutícola Vale Verde
Beirão,0.36,l,23.0174,2026-03-30,Bebidas & Companhia
Bife de atum,2.14,kg,21.6987,2026-03-30,Peixaria do Porto
Bombay,0.14,l,31.3371,2026-03-30,Bebidas & Companhia
CRF-Reserva,0.28,l,29.6349,2026-03-30,Bebidas & Companhia
Café moído,1.31,kg,22.4617,2026-03-30,Mercearia Atlântico
Camarão,1.37,kg,20.1059,2026-03-30,Peixaria do Porto
Camarão da costa,1.19,kg,29.907,2026-03-30,Peixaria do Porto
Canela,0.05,kg,17.6592,2026-03-30,Mercearia Atlântico
Carne de vaca,0.26,kg,14.6475,2026-03-30,Talho Central
Cebola,0.81,kg,0.98,2026-03-30,Hortofrutícola Vale Verde
Cenoura,0.16,kg,1.1334,2026-03-30,Hortofrutícola Vale Verde
Chouriço,0.67,kg,11.0924,2026-03-30,Talho Central
Coca-Cola,10.87,l,2.1581,2026-03-30,Distribuidora Refrescos Lda
Coentros,0.15,kg,9.4671,2026-03-30,Hortofrutícola Vale Verde
Compal Néctar,0.51,l,3.4858,2026-03-30,Distribuidora Refrescos Lda
Coxa de pato,0.87,kg,11.9735,2026-03-30,Talho Central
ES Ortigão Nektar,1.37,l,2.4961,2026-03-30,Garrafeira Nacional
ES S. Domingos Extra Reserva,0.81,l,3.6935,2026-03-30,Garrafeira Nacional
Entrecosto de porco,2.73,kg,8.3857,2026-03-30,Talho Central
Entrecôte,4.12,kg,19.0965,2026-03-30,Talho Central
Filetes de peixe galo,16.49,kg,19.4155,2026-03-30,Peixaria do Porto
Filetes de polvo,3.56,kg,14.8749,2026-03-30,Peixaria do Porto
Fruta da época,0.35,kg,2.0965,2026-03-30,Hortofrutícola Vale Verde
Gelado,0.34,kg,5.7362,2026-03-30,Mercearia Atlântico
Ingredientes variados,3.65,kg,4.9343,2026-03-30,Mercearia Atlântico
Legumes,3.39,kg,1.7451,2026-03-30,Hortofrutícola Vale Verde
Legumes salteados,1.16,kg,1.8078,2026-03-30,Hortofrutícola Vale Verde
Legumes variados,3.05,kg,1.7376,2026-03-30,Hortofrutícola Vale Verde
Leite,0.44,l,1.0328,2026-03-30,Lacticínios Serra
Limão,0.21,kg,2.5077,2026-03-30,Hortofrutícola Vale Verde
Lombo de bacalhau,6.01,kg,34.7496,2026-03-30,Peixaria do Porto
Lombo de vaca,0.18,kg,19.741,2026-03-30,Talho Central
Malagueta,0.01,kg,7.3475,2026-03-30,Hortofrutícola Vale Verde
Manteiga,1.58,kg,6.8958,2026-03-30,Lacticínios Serra
Martini,0.05,l,18.7142,2026-03-30,Bebidas & Companhia
Maçã,1.57,kg,1.8856,2026-03-30,Hortofrutícola Vale Verde
Mini Sagres,8.47,l,2.873,2026-03-30,Distribuidora Refrescos Lda
Molho,0.48,l,6.2584,2026-03-30,Mercearia Atlântico
Molho de frutos vermelhos,0.21,l,5.9609,2026-03-30,Mercearia Atlântico
Moscatel,0.05,l,17.5116,2026-03-30,Bebidas & Companhia
Mostarda,0.01,kg,3.7658,2026-03-30,Mercearia Atlântico
Ovos,45.0,unit,0.2488,2026-03-30,Lacticínios Serra
Pato desfiado,0.36,kg,13.373,2026-03-30,Talho Central
Peito de pato,1.71,kg,13.4282,2026-03-30,Talho Central
Peixe inteiro,4.03,kg,14.1419,2026-03-30,Peixaria do Porto
Peixe variado,4.83,kg,11.476,2026-03-30,Peixaria do Porto
Pera,2.26,kg,2.2079,2026-03-30,Hortofrutícola Vale Verde
Picanha,4.35,kg,17.4937,2026-03-30,Talho Central
Polvo,5.32,kg,14.0204,2026-03-30,Peixaria do Porto
Polvo cozido,0.46,kg,14.4227,2026-03-30,Peixaria do Porto
Presunto,0.31,kg,21.431,2026-03-30,Talho Central
"Pudim (leite, ovos, açúcar)",1.56,kg,4.5836,2026-03-30,Mercearia Atlântico
Pão,7.49,kg,3.4523,2026-03-30,Padaria Forno Antigo
Rabo de boi,0.66,kg,10.7316,2026-03-30,Talho Central
Rabo de boi desfiado,0.6,kg,10.949,2026-03-30,Talho Central
Salsa,0.01,kg,10.0581,2026-03-30,Hortofrutícola Vale Verde
Sangria 1.5L,3.66,l,5.3698,2026-03-30,Distribuidora Refrescos Lda
Sangria 1L,1.01,l,5.5105,2026-03-30,Distribuidora Refrescos Lda
Seven Up,1.23,l,2.1137,2026-03-30,Distribuidora Refrescos Lda
TT Burmester meia gr.,0.46,l,2.5789,2026-03-30,Garrafeira Nacional
TT Dona Matilde,0.89,l,3.9269,2026-03-30,Garrafeira Nacional
TT Dona Matilde Res,2.73,l,9.3004,2026-03-30,Garrafeira Nacional
TT Galhardini,0.71,l,3.1413,2026-03-30,Garrafeira Nacional
TT Titular Reserva,1.92,l,5.0261,2026-03-30,Garrafeira Nacional
TT V.Nídeo Reserva,0.89,l,2.583,2026-03-30,Garrafeira Nacional
TT Vinha Grande,0.87,l,4.6753,2026-03-30,Garrafeira Nacional
Tamboril,1.59,kg,16.5445,2026-03-30,Peixaria do Porto
Tomate,3.38,kg,1.8123,2026-03-30,Hortofrutícola Vale Verde
V Muralhas,0.9,l,1.898,2026-03-30,Garrafeira Nacional
V Regueiro,0.86,l,3.7752,2026-03-30,Garrafeira Nacional
Vinagre,0.04,l,1.8785,2026-03-30,Mercearia Atlântico
Vinho 0.5L,12.16,l,2.7153,2026-03-30,Distribuidora Refrescos Lda
Vinho 1L,3.78,l,0.7612,2026-03-30,Distribuidora Refrescos Lda
Vinho Branco da casa (copo),1.38,l,8.1008,2026-03-30,Distribuidora Refrescos Lda
Vinho Menu,2.7,l,2.5329,2026-03-30,Distribuidora Refrescos Lda
Vinho Tinto da casa (copo),0.88,l,7.7615,2026-03-30,Distribuidora Refrescos Lda
Vinho branco,0.34,l,3.1092,2026-03-30,Mercearia Atlântico
Vinho tinto,1.66,l,2.9007,2026-03-30,Mercearia Atlântico
Água 0.5L,40.29,l,1.1866,2026-03-30,Distribuidora Refrescos Lda
Água Ardente,0.05,l,30.0246,2026-03-30,Bebidas & Companhia
Água c/gás,5.13,l,2.5254,2026-03-30,Distribuidora Refrescos Lda
Alface,0.19,kg,1.4475,2026-04-06,Hortofrutícola Vale Verde
Alho,0.38,kg,4.6549,2026-04-06,Hortofrutícola Vale Verde
Ameijoas,2.92,kg,13.992,2026-04-06,Peixaria do Porto
Arroz,2.64,kg,1.5537,2026-04-06,Mercearia Atlântico
Azeite,2.85,l,6.2368,2026-04-06,Mercearia Atlântico
Azeitonas,2.26,kg,4.6211,2026-04-06,Mercearia Atlântico
Açúcar,0.29,kg,1.1689,2026-04-06,Mercearia Atlântico
BR Duvalley Reserva,0.9,l,4.5055,2026-04-06,Garrafeira Nacional
BR Luis Pato Vinhas Velhas,0.79,l,4.4187,2026-04-06,Garrafeira Nacional
BR Monte Peceguinha,1.34,l,5.4672,2026-04-06,Garrafeira Nacional
BR Piano Moscatel Galego,1.47,l,2.1656,2026-04-06,Garrafeira Nacional
BR Ribeiro Santo Encruzado,2.99,l,4.1668,2026-04-06,Garrafeira Nacional
BR Valle do Nídeo,0.93,l,2.145,2026-04-06,Garrafeira Nacional
BR Volupia,0.75,l,3.4714,2026-04-06,Garrafeira Nacional
Bacalhau desfiado,4.45,kg,26.2969,2026-04-06,Peixaria do Porto
Batata,10.69,kg,1.1068,2026-04-06,Hortofrutícola Vale Verde
Batata a murro,1.46,kg,1.0427,2026-04-06,Hortofrutícola Vale Verde
Batata cozida,3.62,kg,1.0336,2026-04-06,Hortofrutícola Vale Verde
Batata frita,2.11,kg,1.1777,2026-04-06,Hortofrutícola Vale Verde
Batata palha,2.46,kg,1.2647,2026-04-06,Hortofrutícola Vale Verde
Beirão,0.04,l,23.4992,2026-04-06,Bebidas & Companhia
Bife de atum,0.97,kg,21.6635,2026-04-06,Peixaria do Porto
Bife de vaca,0.15,kg,16.1799,2026-04-06,Talho Central
Black Label,0.04,l,46.415,2026-04-06,Bebidas & Companhia
Bombay,0.05,l,31.4845,2026-04-06,Bebidas & Companhia
Bushmills,0.04,l,46.4409,2026-04-06,Bebidas & Companhia
CRF-Reserva,0.09,l,29.0264,2026-04-06,Bebidas & Companhia
Café moído,1.27,kg,21.2926,2026-04-06,Mercearia Atlântico
Camarão,0.69,kg,19.4435,2026-04-06,Peixaria do Porto
Camarão da costa,0.6,kg,29.9352,2026-04-06,Peixaria do Porto
Canela,0.03,kg,17.7495,2026-04-06,Mercearia Atlântico
Cebola,0.73,kg,0.9835,2026-04-06,Hortofrutícola Vale Verde
Cenoura,0.08,kg,1.0493,2026-04-06,Hortofrutícola Vale Verde
Coca-Cola,6.34,l,2.1049,2026-04-06,Distribuidora Refrescos Lda
Coentros,0.06,kg,9.5111,2026-04-06,Hortofrutícola Vale Verde
Compal Néctar,0.17,l,3.7123,2026-04-06,Distribuidora Refrescos Lda
E S.Domingos,1.59,l,3.609,2026-04-06,Garrafeira Nacional
Entrecosto de porco,0.97,kg,8.3808,2026-04-06,Talho Central
Entrecôte,0.97,kg,19.916,2026-04-06,Talho Central
Filetes de peixe galo,13.4,kg,19.7418,2026-04-06,Peixaria do Porto
Filetes de polvo,3.24,kg,16.0915,2026-04-06,Peixaria do Porto
Fruta da época,0.18,kg,2.1488,2026-04-06,Hortofrutícola Vale Verde
Gelado,0.23,kg,6.2005,2026-04-06,Mercearia Atlântico
Ingredientes variados,2.99,kg,4.8241,2026-04-06,Mercearia Atlântico
Legumes,1.02,kg,1.7996,2026-04-06,Hortofrutícola Vale Verde
Legumes salteados,0.53,kg,1.8689,2026-04-06,Hortofrutícola Vale Verde
Legumes variados,2.82,kg,1.8474,2026-04-06,Hortofrutícola Vale Verde
Limão,0.1,kg,2.3955,2026-04-06,Hortofrutícola Vale Verde
Lombo de bacalhau,0.8,kg,35.1323,2026-04-06,Peixaria do Porto
Manteiga,1.16,kg,7.062,2026-04-06,Lacticínios Serra
Martini,0.09,l,18.1227,2026-04-06,Bebidas & Companhia
Maçã,1.22,kg,1.8577,2026-04-06,Hortofrutícola Vale Verde
Melão,0.25,kg,1.5095,2026-04-06,Hortofrutícola Vale Verde
Mini Sagres,4.49,l,2.7922,2026-04-06,Distribuidora Refrescos Lda
Molho,0.11,l,6.2339,2026-04-06,Mercearia Atlântico
Moscatel,0.33,l,17.8057,2026-04-06,Bebidas & Companhia
Mostarda,0.01,kg,3.578,2026-04-06,Mercearia Atlântico
Ovos,63.0,unit,0.2284,2026-04-06,Lacticínios Serra
Peixe inteiro,2.24,kg,14.6952,2026-04-06,Peixaria do Porto
Peixe variado,1.45,kg,12.516,2026-04-06,Peixaria do Porto
Pera,0.94,kg,2.104,2026-04-06,Hortofrutícola Vale Verde
Picanha,1.99,kg,18.4532,2026-04-06,Talho Central
Polvo,2.21,kg,14.0728,2026-04-06,Peixaria do Porto
Polvo cozido,0.23,kg,13.7634,2026-04-06,Peixaria do Porto
Porto 10 anos Tawny,0.03,l,52.9975,2026-04-06,Bebidas & Companhia
Presunto,0.2,kg,21.5298,2026-04-06,Talho Central
"Pudim (leite, ovos, açúcar)",0.78,kg,5.0106,2026-04-06,Mercearia Atlântico
Pão,5.99,kg,3.5184,2026-04-06,Padaria Forno Antigo
RS Qta. Boa Esperança,0.86,l,2.9932,2026-04-06,Garrafeira Nacional
Rabo de boi,0.33,kg,11.0555,2026-04-06,Talho Central
Rabo de boi desfiado,1.03,kg,10.3773,2026-04-06,Talho Central
Sangria 1.5L,3.66,l,5.3865,2026-04-06,Distribuidora Refrescos Lda
Saqueta de chá,1.0,unit,0.097,2026-04-06,Mercearia Atlântico
TT Monte Peceguinha,0.76,l,5.8458,2026-04-06,Garrafeira Nacional
TT Papa Figos,1.65,l,3.2664,2026-04-06,Garrafeira Nacional
TT Ribeiro Santo Res,2.02,l,3.1411,2026-04-06,Garrafeira Nacional
TT Titular Reserva,1.92,l,5.2076,2026-04-06,Garrafeira Nacional
Tamboril,2.04,kg,16.2936,2026-04-06,Peixaria do Porto
Tomate,1.43,kg,1.8445,2026-04-06,Hortofrutícola Vale Verde
V Muralhas,0.9,l,1.8462,2026-04-06,Garrafeira Nacional
Vinagre,0.02,l,1.8606,2026-04-06,Mercearia Atlântico
Vinho 0.5L,6.52,l,2.812,2026-04-06,Distribuidora Refrescos Lda
Vinho 1L,2.52,l,0.7408,2026-04-06,Distribuidora Refrescos Lda
Vinho Branco da casa (copo),1.64,l,8.0908,2026-04-06,Distribuidora Refrescos Lda
Vinho Menu,1.5,l,2.6021,2026-04-06,Distribuidora Refrescos Lda
Vinho Tinto da casa (copo),0.35,l,7.8757,2026-04-06,Distribuidora Refrescos Lda
Vinho branco,0.13,l,3.1044,2026-04-06,Mercearia Atlântico
Vinho tinto,0.7,l,2.8893,2026-04-06,Mercearia Atlântico
Água 0.5L,19.64,l,1.1969,2026-04-06,Distribuidora Refrescos Lda
Água c/gás,2.97,l,2.598,2026-04-06,Distribuidora Refrescos Lda
Aguardente,0.02,l,9.1685,2026-04-13,Mercearia Atlântico
Alface,0.38,kg,1.4756,2026-04-13,Hortofrutícola Vale Verde
Alho,0.37,kg,4.9305,2026-04-13,Hortofrutícola Vale Verde
Ameijoas,1.8,kg,14.6213,2026-04-13,Peixaria do Porto
Arroz,2.87,kg,1.5038,2026-04-13,Mercearia Atlântico
Azeite,2.49,l,5.8412,2026-04-13,Mercearia Atlântico
Azeitonas,1.96,kg,4.8342,2026-04-13,Mercearia Atlântico
Açúcar,0.27,kg,1.1507,2026-04-13,Mercearia Atlântico
BR Duvalley,0.93,l,2.9696,2026-04-13,Garrafeira Nacional
BR GALHARDINI,0.91,l,2.3927,2026-04-13,Garrafeira Nacional
BR Luis Pato Maria Gomes,2.34,l,2.7765,2026-04-13,Garrafeira Nacional
BR Monte Peceguinha,0.67,l,5.7527,2026-04-13,Garrafeira Nacional
BR Planalto,0.7,l,2.1818,2026-04-13,Garrafeira Nacional
BR Qta Lemos D.Paulette,0.65,l,14.1647,2026-04-13,Garrafeira Nacional
BR Ribeiro Santo Encruzado,3.73,l,4.0204,2026-04-13,Garrafeira Nacional
BR Vinha Grande,0.89,l,4.9631,2026-04-13,Garrafeira Nacional
BR Volupia,1.49,l,3.5876,2026-04-13,Garrafeira Nacional
Bacalhau desfiado,1.27,kg,26.9027,2026-04-13,Peixaria do Porto
Batata,9.17,kg,1.0533,2026-04-13,Hortofrutícola Vale Verde
Batata a murro,0.62,kg,1.1257,2026-04-13,Hortofrutícola Vale Verde
Batata cozida,3.53,kg,1.082,2026-04-13,Hortofrutícola Vale Verde
Batata frita,1.64,kg,1.2305,2026-04-13,Hortofrutícola Vale Verde
Batata palha,0.62,kg,1.3838,2026-04-13,Hortofrutícola Vale Verde
Bife de atum,1.94,kg,21.1121,2026-04-13,Peixaria do Porto
Bife de vaca,0.15,kg,17.5739,2026-04-13,Talho Central
Black Label,0.04,l,47.4965,2026-04-13,Bebidas & Companhia
Bolo de chocolate,0.19,kg,7.4645,2026-04-13,Mercearia Atlântico
Bombay,0.09,l,29.1328,2026-04-13,Bebidas & Companhia
CRF-Reserva,0.09,l,31.2522,2026-04-13,Bebidas & Companhia
Café moído,0.78,kg,22.1957,2026-04-13,Mercearia Atlântico
Camarão,1.05,kg,20.0919,2026-04-13,Peixaria do Porto
Camarão da costa,1.49,kg,31.053,2026-04-13,Peixaria do Porto
Canela,0.02,kg,17.8114,2026-04-13,Mercearia Atlântico
Carne de vaca,0.26,kg,14.4333,2026-04-13,Talho Central
Cebola,0.57,kg,0.9902,2026-04-13,Hortofrutícola Vale Verde
Cenoura,0.2,kg,1.0298,2026-04-13,Hortofrutícola Vale Verde
Chocolate,0.03,kg,9.4136,2026-04-13,Mercearia Atlântico
Chouriço,0.49,kg,10.5059,2026-04-13,Talho Central
Coca-Cola,7.25,l,2.2549,2026-04-13,Distribuidora Refrescos Lda
Coentros,0.03,kg,9.506,2026-04-13,Hortofrutícola Vale Verde
E Quinta Ortigão,0.76,l,3.7931,2026-04-13,Garrafeira Nacional
ES S. Domingos Extra Reserva,0.81,l,3.6776,2026-04-13,Garrafeira Nacional
Entrecosto de porco,0.39,kg,8.6926,2026-04-13,Talho Central
Entrecôte,1.7,kg,19.6412,2026-04-13,Talho Central
Filetes de peixe galo,10.3,kg,18.3142,2026-04-13,Peixaria do Porto
Filetes de polvo,3.35,kg,15.1445,2026-04-13,Peixaria do Porto
Fruta da época,0.18,kg,2.2162,2026-04-13,Hortofrutícola Vale Verde
Ingredientes variados,1.55,kg,5.0372,2026-04-13,Mercearia Atlântico
Legumes,1.58,kg,1.7452,2026-04-13,Hortofrutícola Vale Verde
Legumes salteados,1.06,kg,1.7559,2026-04-13,Hortofrutícola Vale Verde
Legumes variados,1.54,kg,1.7894,2026-04-13,Hortofrutícola Vale Verde
Limão,0.07,kg,2.4832,2026-04-13,Hortofrutícola Vale Verde
Lombo de bacalhau,0.4,kg,33.2753,2026-04-13,Peixaria do Porto
Lombo de vaca,0.36,kg,19.6788,2026-04-13,Talho Central
Malagueta,0.01,kg,7.1124,2026-04-13,Hortofrutícola Vale Verde
Manteiga,1.1,kg,6.8431,2026-04-13,Lacticínios Serra
Martini,0.14,l,18.7437,2026-04-13,Bebidas & Companhia
Martini Bianco,0.04,l,17.5441,2026-04-13,Bebidas & Companhia
Maçã,0.7,kg,1.8558,2026-04-13,Hortofrutícola Vale Verde
Melão,0.25,kg,1.5969,2026-04-13,Hortofrutícola Vale Verde
Mini Sagres,2.49,l,2.8189,2026-04-13,Distribuidora Refrescos Lda
Molho,0.2,l,5.7587,2026-04-13,Mercearia Atlântico
Molho de frutos vermelhos,0.03,l,6.1685,2026-04-13,Mercearia Atlântico
Mostarda,0.02,kg,3.4879,2026-04-13,Mercearia Atlântico
Ovos,21.0,unit,0.2379,2026-04-13,Lacticínios Serra
Pato desfiado,1.07,kg,13.2038,2026-04-13,Talho Central
Peito de pato,0.28,kg,12.7093,2026-04-13,Talho Central
Peixe inteiro,1.34,kg,14.8131,2026-04-13,Peixaria do Porto
Peixe variado,2.25,kg,11.6266,2026-04-13,Peixaria do Porto
Pera,1.13,kg,2.2547,2026-04-13,Hortofrutícola Vale Verde
Picanha,0.36,kg,17.3431,2026-04-13,Talho Central
Polvo,1.82,kg,14.9951,2026-04-13,Peixaria do Porto
Polvo cozido,0.23,kg,14.3543,2026-04-13,Peixaria do Porto
Posta de vaca,0.48,kg,18.5314,2026-04-13,Talho Central
Presunto,0.05,kg,21.9844,2026-04-13,Talho Central
"Pudim (leite, ovos, açúcar)",0.59,kg,4.6563,2026-04-13,Mercearia Atlântico
Pão,5.11,kg,3.4967,2026-04-13,Padaria Forno Antigo
Rabo de boi,0.82,kg,10.6911,2026-04-13,Talho Central
Rabo de boi desfiado,0.17,kg,10.5174,2026-04-13,Talho Central
Sangria 1.5L,3.66,l,5.5607,2026-04-13,Distribuidora Refrescos Lda
Sangria 1L,1.01,l,6.0007,2026-04-13,Distribuidora Refrescos Lda
Seven Up,0.62,l,2.2316,2026-04-13,Distribuidora Refrescos Lda
TT Dona Matilde Res,0.91,l,8.651,2026-04-13,Garrafeira Nacional
TT Galhardini,1.41,l,3.1526,2026-04-13,Garrafeira Nacional
TT Papa Figos,0.82,l,3.4226,2026-04-13,Garrafeira Nacional
TT Ribeiro Santo Res,1.35,l,2.9785,2026-04-13,Garrafeira Nacional
TT V.Nídeo Reserva,0.89,l,2.6831,2026-04-13,Garrafeira Nacional
Tamboril,1.13,kg,16.424,2026-04-13,Peixaria do Porto
Tomate,1.81,kg,1.832,2026-04-13,Hortofrutícola Vale Verde
V Muralhas,1.8,l,1.8584,2026-04-13,Garrafeira Nacional
V Regueiro,0.86,l,3.8234,2026-04-13,Garrafeira Nacional
Vinagre,0.03,l,1.7769,2026-04-13,Mercearia Atlântico
Vinho 0.5L,5.21,l,2.6543,2026-04-13,Distribuidora Refrescos Lda
Vinho 1L,3.78,l,0.7568,2026-04-13,Distribuidora Refrescos Lda
Vinho Branco da casa (copo),1.13,l,8.2895,2026-04-13,Distribuidora Refrescos Lda
Vinho Menu,1.8,l,2.6028,2026-04-13,Distribuidora Refrescos Lda
Vinho Tinto da casa (copo),0.7,l,8.3261,2026-04-13,Distribuidora Refrescos Lda
Vinho branco,0.12,l,2.9174,2026-04-13,Mercearia Atlântico
Vinho do Porto (dose),0.07,l,12.3633,2026-04-13,Bebidas & Companhia
Vinho tinto,0.94,l,2.8986,2026-04-13,Mercearia Atlântico
Água 0.5L,20.14,l,1.1684,2026-04-13,Distribuidora Refrescos Lda
Água Ardente,0.05,l,30.0824,2026-04-13,Bebidas & Companhia
Água c/gás,1.89,l,2.5571,2026-04-13,Distribuidora Refrescos Lda
Aguardente,0.02,l,9.4389,2026-04-20,Mercearia Atlântico
Alface,0.19,kg,1.3787,2026-04-20,Hortofrutícola Vale Verde
Alho,0.56,kg,4.6657,2026-04-20,Hortofrutícola Vale Verde
Ameijoas,3.15,kg,13.7876,2026-04-20,Peixaria do Porto
Arroz,1.87,kg,1.5559,2026-04-20,Mercearia Atlântico
Azeite,3.02,l,5.9474,2026-04-20,Mercearia Atlântico
Azeitonas,1.92,kg,4.8761,2026-04-20,Mercearia Atlântico
Açúcar,0.3,kg,1.2335,2026-04-20,Mercearia Atlântico
BR GALHARDINI,2.74,l,2.4073,2026-04-20,Garrafeira Nacional
BR Luis Pato Maria Gomes,0.78,l,2.8196,2026-04-20,Garrafeira Nacional
BR Piano Moscatel Galego,0.74,l,2.252,2026-04-20,Garrafeira Nacional
BR Planalto,0.7,l,2.276,2026-04-20,Garrafeira Nacional
BR Qta Portal Moscatel,1.92,l,3.8873,2026-04-20,Garrafeira Nacional
BR Ribeiro Santo Encruzado,5.23,l,3.9684,2026-04-20,Garrafeira Nacional
Bacalhau desfiado,1.91,kg,27.1133,2026-04-20,Peixaria do Porto
Batata,9.65,kg,1.1066,2026-04-20,Hortofrutícola Vale Verde
Batata a murro,2.08,kg,1.0286,2026-04-20,Hortofrutícola Vale Verde
Batata cozida,5.16,kg,1.0493,2026-04-20,Hortofrutícola Vale Verde
Batata frita,2.49,kg,1.2076,2026-04-20,Hortofrutícola Vale Verde
Batata palha,1.54,kg,1.2985,2026-04-20,Hortofrutícola Vale Verde
Bife de atum,0.19,kg,21.0831,2026-04-20,Peixaria do Porto
Bife de vaca,0.91,kg,17.0326,2026-04-20,Talho Central
Bolo de chocolate,0.58,kg,6.9618,2026-04-20,Mercearia Atlântico
Bushmills,0.07,l,49.7108,2026-04-20,Bebidas & Companhia
Café moído,0.64,kg,21.5905,2026-04-20,Mercearia Atlântico
Camarão,0.92,kg,20.1216,2026-04-20,Peixaria do Porto
Camarão da costa,1.49,kg,31.2087,2026-04-20,Peixaria do Porto
Canela,0.03,kg,17.5423,2026-04-20,Mercearia Atlântico
Carne de vaca,0.51,kg,13.853,2026-04-20,Talho Central
Cebola,0.6,kg,0.921,2026-04-20,Hortofrutícola Vale Verde
Cenoura,0.16,kg,1.0567,2026-04-20,Hortofrutícola Vale Verde
Chocolate,0.1,kg,9.3233,2026-04-20,Mercearia Atlântico
Chouriço,0.19,kg,11.2556,2026-04-20,Talho Central
Coca-Cola,5.13,l,2.0795,2026-04-20,Distribuidora Refrescos Lda
Coentros,0.07,kg,9.9505,2026-04-20,Hortofrutícola Vale Verde
Compal Néctar,0.51,l,3.7376,2026-04-20,Distribuidora Refrescos Lda
Entrecosto de porco,1.56,kg,8.0264,2026-04-20,Talho Central
Entrecôte,1.7,kg,19.6794,2026-04-20,Talho Central
Filetes de peixe galo,12.14,kg,19.9039,2026-04-20,Peixaria do Porto
Filetes de polvo,3.56,kg,16.2017,2026-04-20,Peixaria do Porto
Fruta da época,0.35,kg,2.1486,2026-04-20,Hortofrutícola Vale Verde
Ingredientes variados,1.55,kg,4.5844,2026-04-20,Mercearia Atlântico
Legumes,1.02,kg,1.7909,2026-04-20,Hortofrutícola Vale Verde
Legumes salteados,0.11,kg,1.7376,2026-04-20,Hortofrutícola Vale Verde
Legumes variados,1.74,kg,1.7262,2026-04-20,Hortofrutícola Vale Verde
Limão,0.16,kg,2.4511,2026-04-20,Hortofrutícola Vale Verde
Lombo de bacalhau,2.4,kg,34.7074,2026-04-20,Peixaria do Porto
Lombo de vaca,0.36,kg,19.6069,2026-04-20,Talho Central
Malagueta,0.01,kg,7.5401,2026-04-20,Hortofrutícola Vale Verde
Manteiga,1.05,kg,7.5205,2026-04-20,Lacticínios Serra
Maçã,1.04,kg,1.8056,2026-04-20,Hortofrutícola Vale Verde
Mini Sagres,2.49,l,2.8357,2026-04-20,Distribuidora Refrescos Lda
Molho,0.2,l,5.8546,2026-04-20,Mercearia Atlântico
Molho de frutos vermelhos,0.03,l,6.2052,2026-04-20,Mercearia Atlântico
Moscatel,0.1,l,17.6944,2026-04-20,Bebidas & Companhia
Mostarda,0.08,kg,3.4457,2026-04-20,Mercearia Atlântico
Ovo,3.0,unit,0.2392,2026-04-20,Lacticínios Serra
Ovos,42.0,unit,0.2426,2026-04-20,Lacticínios Serra
Peito de pato,0.28,kg,12.8652,2026-04-20,Talho Central
Peixe inteiro,5.37,kg,14.4319,2026-04-20,Peixaria do Porto
Peixe variado,1.45,kg,11.9714,2026-04-20,Peixaria do Porto
Pera,1.13,kg,2.1018,2026-04-20,Hortofrutícola Vale Verde
Picanha,0.72,kg,17.1489,2026-04-20,Talho Central
Polvo,2.08,kg,14.599,2026-04-20,Peixaria do Porto
Polvo cozido,0.92,kg,15.0603,2026-04-20,Peixaria do Porto
Porto 10 anos Tawny,0.03,l,51.7198,2026-04-20,Bebidas & Companhia
Presunto,0.31,kg,20.8866,2026-04-20,Talho Central
"Pudim (leite, ovos, açúcar)",0.49,kg,4.9171,2026-04-20,Mercearia Atlântico
Pão,5.54,kg,3.5627,2026-04-20,Padaria Forno Antigo
Rabo de boi,0.66,kg,11.2056,2026-04-20,Talho Central
Rabo de boi desfiado,0.51,kg,10.8867,2026-04-20,Talho Central
Salsa,0.01,kg,9.7301,2026-04-20,Hortofrutícola Vale Verde
Seven Up,1.23,l,2.1887,2026-04-20,Distribuidora Refrescos Lda
TT Monte Peceguinha,4.56,l,5.3888,2026-04-20,Garrafeira Nacional
TT V.Nídeo Reserva,0.89,l,2.643,2026-04-20,Garrafeira Nacional
Tamboril,1.13,kg,16.6031,2026-04-20,Peixaria do Porto
Tomate,1.21,kg,1.8876,2026-04-20,Hortofrutícola Vale Verde
Vinagre,0.05,l,1.8378,2026-04-20,Mercearia Atlântico
Vinho 0.5L,5.21,l,2.716,2026-04-20,Distribuidora Refrescos Lda
Vinho 1L,5.03,l,0.7358,2026-04-20,Distribuidora Refrescos Lda
Vinho Branco da casa (copo),0.76,l,8.2195,2026-04-20,Distribuidora Refrescos Lda
Vinho Menu,1.8,l,2.5611,2026-04-20,Distribuidora Refrescos Lda
Vinho Tinto da casa (copo),0.18,l,8.3104,2026-04-20,Distribuidora Refrescos Lda
Vinho branco,0.14,l,3.1469,2026-04-20,Mercearia Atlântico
Vinho tinto,0.91,l,3.0863,2026-04-20,Mercearia Atlântico
Água 0.33L,0.4,l,1.4931,2026-04-20,Distribuidora Refrescos Lda
Água 0.5L,15.61,l,1.1879,2026-04-20,Distribuidora Refrescos Lda
Água c/gás,4.32,l,2.4585,2026-04-20,Distribuidora Refrescos Lda
Aguardente,0.02,l,9.2807,2026-04-27,Mercearia Atlântico
Alface,0.66,kg,1.3783,2026-04-27,Hortofrutícola Vale Verde
Alheira,0.24,kg,9.6274,2026-04-27,Talho Central
Alho,0.58,kg,4.664,2026-04-27,Hortofrutícola Vale Verde
Ameijoas,2.02,kg,13.7307,2026-04-27,Peixaria do Porto
Arroz,2.53,kg,1.5272,2026-04-27,Mercearia Atlântico
Azeite,2.96,l,6.2459,2026-04-27,Mercearia Atlântico
Azeitonas,2.15,kg,4.7717,2026-04-27,Mercearia Atlântico
Açúcar,0.49,kg,1.2146,2026-04-27,Mercearia Atlântico
BR GALHARDINI,2.74,l,2.3589,2026-04-27,Garrafeira Nacional
BR Luis Pato Maria Gomes,0.78,l,2.865,2026-04-27,Garrafeira Nacional
BR Monte Peceguinha,0.67,l,5.5668,2026-04-27,Garrafeira Nacional
BR Papa Figos,1.62,l,3.4612,2026-04-27,Garrafeira Nacional
BR Piano Moscatel Galego,0.74,l,2.3011,2026-04-27,Garrafeira Nacional
BR Planalto,0.7,l,2.3088,2026-04-27,Garrafeira Nacional
BR Valle do Nídeo,1.85,l,2.1525,2026-04-27,Garrafeira Nacional
BR Vinha Grande,1.78,l,4.7389,2026-04-27,Garrafeira Nacional
BR Volupia,2.24,l,3.4967,2026-04-27,Garrafeira Nacional
Bacalhau desfiado,1.27,kg,25.6527,2026-04-27,Peixaria do Porto
Batata,9.86,kg,1.0997,2026-04-27,Hortofrutícola Vale Verde
Batata a murro,2.49,kg,1.1091,2026-04-27,Hortofrutícola Vale Verde
Batata cozida,4.71,kg,1.0849,2026-04-27,Hortofrutícola Vale Verde
Batata frita,2.39,kg,1.2144,2026-04-27,Hortofrutícola Vale Verde
Batata palha,1.08,kg,1.2666,2026-04-27,Hortofrutícola Vale Verde
Beirão,0.04,l,23.4459,2026-04-27,Bebidas & Companhia
Bife de atum,1.55,kg,22.1043,2026-04-27,Peixaria do Porto
Bife de vaca,0.15,kg,16.277,2026-04-27,Talho Central
Black Label,0.38,l,48.3359,2026-04-27,Bebidas & Companhia
Café moído,0.87,kg,20.68,2026-04-27,Mercearia Atlântico
Camarão,0.75,kg,18.4994,2026-04-27,Peixaria do Porto
Camarão da costa,0.9,kg,29.8405,2026-04-27,Peixaria do Porto
Canela,0.04,kg,18.1986,2026-04-27,Mercearia Atlântico
Carne de vaca,0.51,kg,14.9184,2026-04-27,Talho Central
Cebola,0.66,kg,0.9592,2026-04-27,Hortofrutícola Vale Verde
Cenoura,0.24,kg,1.0889,2026-04-27,Hortofrutícola Vale Verde
Chouriço,0.19,kg,11.2764,2026-04-27,Talho Central
Coca-Cola,6.34,l,2.162,2026-04-27,Distribuidora Refrescos Lda
Coentros,0.04,kg,9.7813,2026-04-27,Hortofrutícola Vale Verde
Coxa de pato,0.58,kg,11.9278,2026-04-27,Talho Central
Entrecosto de porco,0.58,kg,8.2347,2026-04-27,Talho Central
Entrecôte,1.7,kg,19.4431,2026-04-27,Talho Central
Filetes de peixe galo,9.73,kg,18.6952,2026-04-27,Peixaria do Porto
Filetes de polvo,4.75,kg,16.1144,2026-04-27,Peixaria do Porto
Fruta da época,0.18,kg,2.1906,2026-04-27,Hortofrutícola Vale Verde
Gelado,0.46,kg,5.9678,2026-04-27,Mercearia Atlântico
Ingredientes variados,2.88,kg,4.9166,2026-04-27,Mercearia Atlântico
Legumes,0.9,kg,1.7967,2026-04-27,Hortofrutícola Vale Verde
Legumes salteados,0.85,kg,1.7158,2026-04-27,Hortofrutícola Vale Verde
Legumes variados,2.0,kg,1.8461,2026-04-27,Hortofrutícola Vale Verde
Leite,0.65,l,1.0859,2026-04-27,Lacticínios Serra
Limão,0.05,kg,2.4165,2026-04-27,Hortofrutícola Vale Verde
Lombo de bacalhau,2.4,kg,33.3713,2026-04-27,Peixaria do Porto
Lombo de vaca,0.36,kg,18.856,2026-04-27,Talho Central
Malagueta,0.01,kg,6.9511,2026-04-27,Hortofrutícola Vale Verde
Manteiga,1.21,kg,7.0001,2026-04-27,Lacticínios Serra
Maçã,0.87,kg,1.8874,2026-04-27,Hortofrutícola Vale Verde
Mini Sagres,3.49,l,2.955,2026-04-27,Distribuidora Refrescos Lda
Molho,0.2,l,5.8957,2026-04-27,Mercearia Atlântico
Molho de frutos vermelhos,0.14,l,6.1558,2026-04-27,Mercearia Atlântico
Mostarda,0.03,kg,3.7559,2026-04-27,Mercearia Atlântico
Ovo,2.0,unit,0.2393,2026-04-27,Lacticínios Serra
Ovos,28.0,unit,0.228,2026-04-27,Lacticínios Serra
Peito de pato,1.14,kg,13.0842,2026-04-27,Talho Central
Peixe inteiro,0.9,kg,14.4386,2026-04-27,Peixaria do Porto
Peixe variado,1.29,kg,12.0188,2026-04-27,Peixaria do Porto
Pera,1.51,kg,2.1018,2026-04-27,Hortofrutícola Vale Verde
Picanha,1.63,kg,17.9985,2026-04-27,Talho Central
Polvo,3.12,kg,14.4681,2026-04-27,Peixaria do Porto
Polvo cozido,0.69,kg,15.0163,2026-04-27,Peixaria do Porto
Posta de vaca,0.96,kg,18.0004,2026-04-27,Talho Central
Presunto,0.23,kg,21.9003,2026-04-27,Talho Central
"Pudim (leite, ovos, açúcar)",1.17,kg,4.914,2026-04-27,Mercearia Atlântico
Pão,6.07,kg,3.4512,2026-04-27,Padaria Forno Antigo
Rabo de boi,0.98,kg,10.5439,2026-04-27,Talho Central
Rabo de boi desfiado,0.86,kg,11.3387,2026-04-27,Talho Central
Salsa,0.01,kg,9.6979,2026-04-27,Hortofrutícola Vale Verde
Sangria 1.5L,1.83,l,5.4731,2026-04-27,Distribuidora Refrescos Lda
Saqueta de chá,1.0,unit,0.1007,2026-04-27,Mercearia Atlântico
TT Dona Matilde,1.78,l,3.8101,2026-04-27,Garrafeira Nacional
TT Duvalley Reserva,0.73,l,6.9556,2026-04-27,Garrafeira Nacional
TT Monte Peceguinha,1.52,l,5.6709,2026-04-27,Garrafeira Nacional
TT Papa Figos,2.47,l,3.2682,2026-04-27,Garrafeira Nacional
TT V.Nídeo Reserva,0.89,l,2.623,2026-04-27,Garrafeira Nacional
TT Vinha Grande,2.6,l,5.0366,2026-04-27,Garrafeira Nacional
Tamboril,0.68,kg,17.0076,2026-04-27,Peixaria do Porto
Tomate,1.44,kg,1.8348,2026-04-27,Hortofrutícola Vale Verde
V Muralhas,1.8,l,1.9905,2026-04-27,Garrafeira Nacional
V Regueiro,1.73,l,3.7737,2026-04-27,Garrafeira Nacional
Vinagre,0.07,l,1.8052,2026-04-27,Mercearia Atlântico
Vinho 0.5L,9.12,l,2.7913,2026-04-27,Distribuidora Refrescos Lda
Vinho 1L,2.52,l,0.7359,2026-04-27,Distribuidora Refrescos Lda
Vinho Branco da casa (copo),0.38,l,7.8295,2026-04-27,Distribuidora Refrescos Lda
Vinho Menu,1.8,l,2.4649,2026-04-27,Distribuidora Refrescos Lda
Vinho Tinto da casa (copo),0.35,l,8.3249,2026-04-27,Distribuidora Refrescos Lda
Vinho branco,0.14,l,2.9385,2026-04-27,Mercearia Atlântico
Vinho do Porto (dose),0.07,l,11.8003,2026-04-27,Bebidas & Companhia
Vinho tinto,1.23,l,3.1217,2026-04-27,Mercearia Atlântico
Água 0.5L,22.16,l,1.1513,2026-04-27,Distribuidora Refrescos Lda
Água c/gás,2.43,l,2.4881,2026-04-27,Distribuidora Refrescos Lda
Alface,0.28,kg,1.4704,2026-05-04,Hortofrutícola Vale Verde
Alho,0.45,kg,4.9245,2026-05-04,Hortofrutícola Vale Verde
Ameijoas,3.59,kg,13.619,2026-05-04,Peixaria do Porto
Arroz,1.55,kg,1.5843,2026-05-04,Mercearia Atlântico
Azeite,2.11,l,5.7127,2026-05-04,Mercearia Atlântico
Azeitonas,1.51,kg,4.8512,2026-05-04,Mercearia Atlântico
Açúcar,0.42,kg,1.1455,2026-05-04,Mercearia Atlântico
BR Burmester meia gr.,0.45,l,2.6891,2026-05-04,Garrafeira Nacional
BR Dona Matilde,0.81,l,3.6462,2026-05-04,Garrafeira Nacional
BR GALHARDINI,1.82,l,2.2123,2026-05-04,Garrafeira Nacional
BR Luis Pato Maria Gomes,0.78,l,2.8013,2026-05-04,Garrafeira Nacional
BR Piano Moscatel Galego,0.74,l,2.1717,2026-05-04,Garrafeira Nacional
BR Volupia,0.75,l,3.6415,2026-05-04,Garrafeira Nacional
Bacalhau desfiado,1.27,kg,25.1373,2026-05-04,Peixaria do Porto
Batata,8.49,kg,1.0338,2026-05-04,Hortofrutícola Vale Verde
Batata a murro,1.25,kg,1.0738,2026-05-04,Hortofrutícola Vale Verde
Batata cozida,3.08,kg,1.0794,2026-05-04,Hortofrutícola Vale Verde
Batata frita,2.9,kg,1.2472,2026-05-04,Hortofrutícola Vale Verde
Batata palha,0.92,kg,1.366,2026-05-04,Hortofrutícola Vale Verde
Beirão,0.04,l,23.9134,2026-05-04,Bebidas & Companhia
Bife de atum,1.17,kg,21.003,2026-05-04,Peixaria do Porto
Bolo de chocolate,0.19,kg,7.4518,2026-05-04,Mercearia Atlântico
Café moído,0.69,kg,20.5438,2026-05-04,Mercearia Atlântico
Camarão,0.23,kg,18.5829,2026-05-04,Peixaria do Porto
Camarão da costa,0.45,kg,31.2117,2026-05-04,Peixaria do Porto
Canela,0.03,kg,17.734,2026-05-04,Mercearia Atlântico
Carne de vaca,0.26,kg,15.076,2026-05-04,Talho Central
Cebola,0.38,kg,0.9173,2026-05-04,Hortofrutícola Vale Verde
Cenoura,0.04,kg,1.0912,2026-05-04,Hortofrutícola Vale Verde
Chocolate,0.03,kg,9.7093,2026-05-04,Mercearia Atlântico
Coca-Cola,3.62,l,2.1055,2026-05-04,Distribuidora Refrescos Lda
Coentros,0.08,kg,9.6518,2026-05-04,Hortofrutícola Vale Verde
Compal Néctar,0.17,l,3.7593,2026-05-04,Distribuidora Refrescos Lda
ES Ortigão Nektar,1.37,l,2.4372,2026-05-04,Garrafeira Nacional
ES Quinta Monteirinhos,1.89,l,5.3252,2026-05-04,Garrafeira Nacional
Entrecosto de porco,1.56,kg,8.4416,2026-05-04,Talho Central
Entrecôte,1.7,kg,19.4203,2026-05-04,Talho Central
Filetes de peixe galo,8.82,kg,19.3909,2026-05-04,Peixaria do Porto
Filetes de polvo,3.46,kg,16.3069,2026-05-04,Peixaria do Porto
Gelado,0.69,kg,5.7921,2026-05-04,Mercearia Atlântico
Ingredientes variados,1.77,kg,4.9079,2026-05-04,Mercearia Atlântico
Legumes,0.34,kg,1.7415,2026-05-04,Hortofrutícola Vale Verde
Legumes salteados,0.63,kg,1.7919,2026-05-04,Hortofrutícola Vale Verde
Legumes variados,1.03,kg,1.8259,2026-05-04,Hortofrutícola Vale Verde
Leite,0.87,l,1.1059,2026-05-04,Lacticínios Serra
Limão,0.04,kg,2.3225,2026-05-04,Hortofrutícola Vale Verde
Lombo de bacalhau,1.6,kg,33.4142,2026-05-04,Peixaria do Porto
Lombo de vaca,0.54,kg,19.7813,2026-05-04,Talho Central
Manteiga,0.83,kg,7.3152,2026-05-04,Lacticínios Serra
Marisco variado,0.42,kg,16.4221,2026-05-04,Peixaria do Porto
Maçã,0.35,kg,1.8129,2026-05-04,Hortofrutícola Vale Verde
Melão,0.5,kg,1.5288,2026-05-04,Hortofrutícola Vale Verde
Mini Sagres,5.23,l,2.8259,2026-05-04,Distribuidora Refrescos Lda
Molho,0.2,l,5.9504,2026-05-04,Mercearia Atlântico
Molho de frutos vermelhos,0.17,l,6.1946,2026-05-04,Mercearia Atlântico
Mostarda,0.01,kg,3.6839,2026-05-04,Mercearia Atlântico
Ovos,21.0,unit,0.2317,2026-05-04,Lacticínios Serra
Peito de pato,1.42,kg,12.7732,2026-05-04,Talho Central
Peixe variado,0.48,kg,11.8428,2026-05-04,Peixaria do Porto
Pera,1.13,kg,2.1297,2026-05-04,Hortofrutícola Vale Verde
Picanha,1.27,kg,18.7662,2026-05-04,Talho Central
Polvo,1.04,kg,13.7057,2026-05-04,Peixaria do Porto
Polvo cozido,0.46,kg,13.9699,2026-05-04,Peixaria do Porto
Posta de vaca,0.48,kg,18.7649,2026-05-04,Talho Central
Presunto,0.26,kg,21.5508,2026-05-04,Talho Central
"Pudim (leite, ovos, açúcar)",0.39,kg,5.0169,2026-05-04,Mercearia Atlântico
Pão,3.91,kg,3.493,2026-05-04,Padaria Forno Antigo
Rabo de boi,0.16,kg,10.773,2026-05-04,Talho Central
Rabo de boi desfiado,0.26,kg,11.0988,2026-05-04,Talho Central
Salsa,0.01,kg,10.0124,2026-05-04,Hortofrutícola Vale Verde
Saqueta de chá,2.0,unit,0.0957,2026-05-04,Mercearia Atlântico
Seven Up,0.92,l,2.1685,2026-05-04,Distribuidora Refrescos Lda
TT Duvalley,0.86,l,2.5568,2026-05-04,Garrafeira Nacional
TT Galhardini,2.12,l,3.2472,2026-05-04,Garrafeira Nacional
TT Monte Peceguinha,1.52,l,5.8574,2026-05-04,Garrafeira Nacional
TT Ribeiro Santo Res,2.02,l,3.131,2026-05-04,Garrafeira Nacional
TT Ribeiro Santo colheita,0.67,l,2.2319,2026-05-04,Garrafeira Nacional
Tamboril,0.45,kg,16.3726,2026-05-04,Peixaria do Porto
Tomate,0.72,kg,1.7217,2026-05-04,Hortofrutícola Vale Verde
Vinagre,0.04,l,1.7133,2026-05-04,Mercearia Atlântico
Vinho 0.5L,5.21,l,2.7616,2026-05-04,Distribuidora Refrescos Lda
Vinho 1L,3.78,l,0.7745,2026-05-04,Distribuidora Refrescos Lda
Vinho Branco da casa (copo),0.38,l,7.6822,2026-05-04,Distribuidora Refrescos Lda
Vinho Menu,2.99,l,2.647,2026-05-04,Distribuidora Refrescos Lda
Vinho Tinto da casa (copo),0.18,l,8.1873,2026-05-04,Distribuidora Refrescos Lda
Vinho branco,0.15,l,2.9449,2026-05-04,Mercearia Atlântico
Vinho tinto,0.79,l,2.9173,2026-05-04,Mercearia Atlântico
Água 0.5L,10.07,l,1.1578,2026-05-04,Distribuidora Refrescos Lda
Água c/gás,1.62,l,2.3907,2026-05-04,Distribuidora Refrescos Lda
Aguardente,0.08,l,9.5267,2026-05-11,Mercearia Atlântico
Alface,0.28,kg,1.3824,2026-05-11,Hortofrutícola Vale Verde
Alho,0.77,kg,4.5942,2026-05-11,Hortofrutícola Vale Verde
Ameijoas,3.82,kg,13.6992,2026-05-11,Peixaria do Porto
Arroz,1.36,kg,1.6161,2026-05-11,Mercearia Atlântico
Azeite,3.81,l,6.1158,2026-05-11,Mercearia Atlântico
Azeitonas,2.88,kg,4.7743,2026-05-11,Mercearia Atlântico
Açúcar,0.39,kg,1.1744,2026-05-11,Mercearia Atlântico
BR GALHARDINI,1.82,l,2.26,2026-05-11,Garrafeira Nacional
BR Luis Pato Vinhas Velhas,1.58,l,4.3915,2026-05-11,Garrafeira Nacional
BR Monte Peceguinha,3.36,l,5.5701,2026-05-11,Garrafeira Nacional
BR Papa Figos,3.24,l,3.2635,2026-05-11,Garrafeira Nacional
BR Ribeiro Santo Encruzado,11.2,l,4.2216,2026-05-11,Garrafeira Nacional
BR V. Nídeo SauvignonBlanc,0.74,l,3.0079,2026-05-11,Garrafeira Nacional
Bacalhau desfiado,2.86,kg,27.2192,2026-05-11,Peixaria do Porto
Batata,13.37,kg,1.0539,2026-05-11,Hortofrutícola Vale Verde
Batata a murro,3.12,kg,1.0715,2026-05-11,Hortofrutícola Vale Verde
Batata cozida,4.53,kg,1.1216,2026-05-11,Hortofrutícola Vale Verde
Batata frita,2.53,kg,1.1802,2026-05-11,Hortofrutícola Vale Verde
Batata palha,2.15,kg,1.3039,2026-05-11,Hortofrutícola Vale Verde
Bife de atum,1.55,kg,22.6526,2026-05-11,Peixaria do Porto
Bife de vaca,0.3,kg,16.0311,2026-05-11,Talho Central
CRF-Reserva,0.09,l,28.7652,2026-05-11,Bebidas & Companhia
Café moído,1.56,kg,21.9763,2026-05-11,Mercearia Atlântico
Camarão,1.72,kg,18.8923,2026-05-11,Peixaria do Porto
Camarão da costa,0.9,kg,30.7915,2026-05-11,Peixaria do Porto
Canela,0.04,kg,17.3516,2026-05-11,Mercearia Atlântico
Carne de vaca,0.26,kg,14.4035,2026-05-11,Talho Central
Cebola,0.55,kg,0.9938,2026-05-11,Hortofrutícola Vale Verde
Cenoura,0.04,kg,1.0668,2026-05-11,Hortofrutícola Vale Verde
Chouriço,0.94,kg,10.358,2026-05-11,Talho Central
Coca-Cola,7.85,l,2.2446,2026-05-11,Distribuidora Refrescos Lda
Coentros,0.09,kg,9.9319,2026-05-11,Hortofrutícola Vale Verde
Compal Néctar,0.34,l,3.7234,2026-05-11,Distribuidora Refrescos Lda
Coxa de pato,0.87,kg,11.7887,2026-05-11,Talho Central
ES Quinta Monteirinhos,0.95,l,5.5488,2026-05-11,Garrafeira Nacional
ES S. Domingos Extra Reserva,0.81,l,3.7636,2026-05-11,Garrafeira Nacional
Entrecosto de porco,2.53,kg,8.6132,2026-05-11,Talho Central
Entrecôte,0.73,kg,18.2819,2026-05-11,Talho Central
Filetes de peixe galo,15.91,kg,19.4895,2026-05-11,Peixaria do Porto
Filetes de polvo,4.75,kg,15.0008,2026-05-11,Peixaria do Porto
Gelado,0.23,kg,6.2672,2026-05-11,Mercearia Atlântico
Ingredientes variados,2.32,kg,5.0174,2026-05-11,Mercearia Atlântico
Jameson,0.04,l,29.9678,2026-05-11,Bebidas & Companhia
Legumes,1.24,kg,1.8039,2026-05-11,Hortofrutícola Vale Verde
Legumes salteados,0.85,kg,1.7371,2026-05-11,Hortofrutícola Vale Verde
Legumes variados,2.2,kg,1.8796,2026-05-11,Hortofrutícola Vale Verde
Limão,0.05,kg,2.2833,2026-05-11,Hortofrutícola Vale Verde
Lombo de bacalhau,2.4,kg,33.4404,2026-05-11,Peixaria do Porto
Lombo de vaca,0.18,kg,19.2078,2026-05-11,Talho Central
Malagueta,0.02,kg,7.1822,2026-05-11,Hortofrutícola Vale Verde
Manteiga,1.58,kg,7.4468,2026-05-11,Lacticínios Serra
Martel,0.05,l,16.2191,2026-05-11,Bebidas & Companhia
Maçã,1.57,kg,1.8238,2026-05-11,Hortofrutícola Vale Verde
Mini Sagres,2.99,l,2.934,2026-05-11,Distribuidora Refrescos Lda
Molho,0.09,l,6.0091,2026-05-11,Mercearia Atlântico
Molho de frutos vermelhos,0.03,l,5.7916,2026-05-11,Mercearia Atlântico
Mostarda,0.03,kg,3.5802,2026-05-11,Mercearia Atlântico
Ovos,59.0,unit,0.2407,2026-05-11,Lacticínios Serra
Peito de pato,0.28,kg,12.727,2026-05-11,Talho Central
Peixe inteiro,1.34,kg,14.5347,2026-05-11,Peixaria do Porto
Peixe variado,1.77,kg,11.8972,2026-05-11,Peixaria do Porto
Pera,1.32,kg,2.0622,2026-05-11,Hortofrutícola Vale Verde
Picanha,1.09,kg,17.3357,2026-05-11,Talho Central
Polvo,4.02,kg,14.1766,2026-05-11,Peixaria do Porto
Polvo cozido,0.23,kg,15.0926,2026-05-11,Peixaria do Porto
Presunto,0.38,kg,22.527,2026-05-11,Talho Central
"Pudim (leite, ovos, açúcar)",0.59,kg,5.0261,2026-05-11,Mercearia Atlântico
Pão,7.64,kg,3.6072,2026-05-11,Padaria Forno Antigo
RS Papa Figos,1.58,l,3.2735,2026-05-11,Garrafeira Nacional
RS Titular Rosé,0.95,l,2.6072,2026-05-11,Garrafeira Nacional
Rabo de boi,0.16,kg,10.4925,2026-05-11,Talho Central
Rabo de boi desfiado,0.6,kg,10.9235,2026-05-11,Talho Central
Sangria 1.5L,1.83,l,5.4079,2026-05-11,Distribuidora Refrescos Lda
Saqueta de chá,3.0,unit,0.0939,2026-05-11,Mercearia Atlântico
Seven Up,0.31,l,2.1921,2026-05-11,Distribuidora Refrescos Lda
TT Ribeiro Santo Res,0.67,l,2.9519,2026-05-11,Garrafeira Nacional
TT V.Nídeo Reserva,0.89,l,2.4445,2026-05-11,Garrafeira Nacional
Tamboril,0.68,kg,15.9873,2026-05-11,Peixaria do Porto
Tomate,1.26,kg,1.7603,2026-05-11,Hortofrutícola Vale Verde
V Muralhas,2.69,l,1.8077,2026-05-11,Garrafeira Nacional
V Regueiro,1.73,l,3.7952,2026-05-11,Garrafeira Nacional
Vinagre,0.03,l,1.8509,2026-05-11,Mercearia Atlântico
Vinho 0.5L,6.95,l,2.5838,2026-05-11,Distribuidora Refrescos Lda
Vinho 1L,5.03,l,0.746,2026-05-11,Distribuidora Refrescos Lda
Vinho Menu,1.5,l,2.5536,2026-05-11,Distribuidora Refrescos Lda
Vinho Tinto da casa (copo),0.88,l,8.3901,2026-05-11,Distribuidora Refrescos Lda
Vinho branco,0.09,l,2.8826,2026-05-11,Mercearia Atlântico
Vinho tinto,0.92,l,2.9225,2026-05-11,Mercearia Atlântico
Água 0.5L,19.14,l,1.1375,2026-05-11,Distribuidora Refrescos Lda
Água c/gás,4.59,l,2.5338,2026-05-11,Distribuidora Refrescos Lda
Alface,0.09,kg,1.3741,2026-05-18,Hortofrutícola Vale Verde
Alheira,0.12,kg,9.6983,2026-05-18,Talho Central
Alho,0.27,kg,4.8147,2026-05-18,Hortofrutícola Vale Verde
Ameijoas,1.8,kg,13.8458,2026-05-18,Peixaria do Porto
Arroz,1.32,kg,1.5132,2026-05-18,Mercearia Atlântico
Azeite,1.83,l,5.8119,2026-05-18,Mercearia Atlântico
Azeitonas,1.58,kg,4.7334,2026-05-18,Mercearia Atlântico
Açúcar,0.27,kg,1.181,2026-05-18,Mercearia Atlântico
BR A.Mayor Comendador,0.85,l,8.6301,2026-05-18,Garrafeira Nacional
BR Dona Matilde,0.81,l,3.8746,2026-05-18,Garrafeira Nacional
BR Luis Pato Vinhas Velhas,1.58,l,4.2373,2026-05-18,Garrafeira Nacional
BR Monte Peceguinha,0.67,l,5.5134,2026-05-18,Garrafeira Nacional
BR Papa Figos,1.62,l,3.3857,2026-05-18,Garrafeira Nacional
BR Titular Colheita,0.72,l,2.5621,2026-05-18,Garrafeira Nacional
BR Volupia,1.49,l,3.7364,2026-05-18,Garrafeira Nacional
Bacalhau desfiado,1.27,kg,26.001,2026-05-18,Peixaria do Porto
Batata,5.75,kg,1.0915,2026-05-18,Hortofrutícola Vale Verde
Batata a murro,1.04,kg,1.0878,2026-05-18,Hortofrutícola Vale Verde
Batata cozida,2.44,kg,1.1131,2026-05-18,Hortofrutícola Vale Verde
Batata frita,1.28,kg,1.2136,2026-05-18,Hortofrutícola Vale Verde
Batata palha,1.23,kg,1.3486,2026-05-18,Hortofrutícola Vale Verde
Bife de atum,0.58,kg,20.9819,2026-05-18,Peixaria do Porto
Bolo de chocolate,0.68,kg,7.4206,2026-05-18,Mercearia Atlântico
CRF-Reserva,0.14,l,29.7425,2026-05-18,Bebidas & Companhia
Café moído,0.62,kg,21.2601,2026-05-18,Mercearia Atlântico
Camarão,0.32,kg,18.4123,2026-05-18,Peixaria do Porto
Camarão da costa,0.6,kg,29.803,2026-05-18,Peixaria do Porto
Canela,0.02,kg,17.3931,2026-05-18,Mercearia Atlântico
Carne de vaca,0.26,kg,14.4276,2026-05-18,Talho Central
Cebola,0.28,kg,0.9294,2026-05-18,Hortofrutícola Vale Verde
Cenoura,0.08,kg,1.0614,2026-05-18,Hortofrutícola Vale Verde
Chocolate,0.12,kg,9.4161,2026-05-18,Mercearia Atlântico
Coca-Cola,3.02,l,2.1806,2026-05-18,Distribuidora Refrescos Lda
Coentros,0.03,kg,10.0575,2026-05-18,Hortofrutícola Vale Verde
Entrecosto de porco,0.39,kg,8.6242,2026-05-18,Talho Central
Entrecôte,0.73,kg,18.2884,2026-05-18,Talho Central
Filetes de peixe galo,6.53,kg,20.0389,2026-05-18,Peixaria do Porto
Filetes de polvo,2.05,kg,15.9282,2026-05-18,Peixaria do Porto
Fruta da época,0.35,kg,2.2527,2026-05-18,Hortofrutícola Vale Verde
Gelado,0.23,kg,5.8441,2026-05-18,Mercearia Atlântico
Ingredientes variados,1.33,kg,4.9186,2026-05-18,Mercearia Atlântico
Legumes,1.69,kg,1.7171,2026-05-18,Hortofrutícola Vale Verde
Legumes salteados,0.32,kg,1.872,2026-05-18,Hortofrutícola Vale Verde
Legumes variados,2.26,kg,1.877,2026-05-18,Hortofrutícola Vale Verde
Limão,0.08,kg,2.2875,2026-05-18,Hortofrutícola Vale Verde
Lombo de bacalhau,1.2,kg,34.7848,2026-05-18,Peixaria do Porto
Lombo de vaca,0.36,kg,19.9594,2026-05-18,Talho Central
Manteiga,0.88,kg,7.0117,2026-05-18,Lacticínios Serra
Mini Sagres,1.99,l,2.9662,2026-05-18,Distribuidora Refrescos Lda
Molho,0.09,l,5.8213,2026-05-18,Mercearia Atlântico
Molho de frutos vermelhos,0.03,l,6.2966,2026-05-18,Mercearia Atlântico
Mostarda,0.01,kg,3.612,2026-05-18,Mercearia Atlântico
Ovos,28.0,unit,0.2392,2026-05-18,Lacticínios Serra
Peito de pato,0.28,kg,12.6645,2026-05-18,Talho Central
Peixe inteiro,1.79,kg,13.8683,2026-05-18,Peixaria do Porto
Peixe variado,2.41,kg,11.7175,2026-05-18,Peixaria do Porto
Pera,1.51,kg,2.2061,2026-05-18,Hortofrutícola Vale Verde
Picanha,0.72,kg,17.4202,2026-05-18,Talho Central
Polvo,1.04,kg,14.2442,2026-05-18,Peixaria do Porto
Presunto,0.31,kg,22.1544,2026-05-18,Talho Central
"Pudim (leite, ovos, açúcar)",0.49,kg,5.0356,2026-05-18,Mercearia Atlântico
Pão,4.76,kg,3.4646,2026-05-18,Padaria Forno Antigo
Rabo de boi,0.33,kg,10.6261,2026-05-18,Talho Central
Rabo de boi desfiado,1.2,kg,10.5558,2026-05-18,Talho Central
Sangria 1.5L,1.83,l,5.1757,2026-05-18,Distribuidora Refrescos Lda
Saqueta de chá,1.0,unit,0.0916,2026-05-18,Mercearia Atlântico
Seven Up,0.31,l,2.2407,2026-05-18,Distribuidora Refrescos Lda
TT Dona Matilde Res,0.91,l,8.7223,2026-05-18,Garrafeira Nacional
TT Duvalley Reserva,1.47,l,7.008,2026-05-18,Garrafeira Nacional
TT Ribeiro Santo Res,0.67,l,2.9755,2026-05-18,Garrafeira Nacional
TT Vinha Grande,0.87,l,4.8685,2026-05-18,Garrafeira Nacional
Tamboril,0.91,kg,17.2539,2026-05-18,Peixaria do Porto
Tomate,1.36,kg,1.8324,2026-05-18,Hortofrutícola Vale Verde
Vinagre,0.01,l,1.7907,2026-05-18,Mercearia Atlântico
Vinho 0.5L,3.48,l,2.5533,2026-05-18,Distribuidora Refrescos Lda
Vinho 1L,1.26,l,0.7276,2026-05-18,Distribuidora Refrescos Lda
Vinho Branco da casa (copo),0.63,l,8.125,2026-05-18,Distribuidora Refrescos Lda
Vinho Menu,2.7,l,2.4722,2026-05-18,Distribuidora Refrescos Lda
Vinho Tinto da casa (copo),0.35,l,7.6273,2026-05-18,Distribuidora Refrescos Lda
Vinho branco,0.12,l,2.9404,2026-05-18,Mercearia Atlântico
Vinho do Porto (dose),0.07,l,11.6315,2026-05-18,Bebidas & Companhia
Vinho tinto,1.08,l,3.1478,2026-05-18,Mercearia Atlântico
Água 0.5L,6.04,l,1.138,2026-05-18,Distribuidora Refrescos Lda
Água c/gás,2.7,l,2.4673,2026-05-18,Distribuidora Refrescos Lda
Alface,0.21,kg,1.4375,2026-06-01,Hortofrutícola Vale Verde
Alho,0.61,kg,4.764,2026-06-01,Hortofrutícola Vale Verde
Ameijoas,3.15,kg,13.8498,2026-06-01,Peixaria do Porto
Arroz,2.42,kg,1.5604,2026-06-01,Mercearia Atlântico
Azeite,3.45,l,5.8622,2026-06-01,Mercearia Atlântico
Azeitonas,2.02,kg,4.8127,2026-06-01,Mercearia Atlântico
Açúcar,0.3,kg,1.2105,2026-06-01,Mercearia Atlântico
BR Burmester meia gr.,0.45,l,2.6826,2026-06-01,Garrafeira Nacional
BR Dona Matilde,0.81,l,3.7491,2026-06-01,Garrafeira Nacional
BR GALHARDINI,0.91,l,2.262,2026-06-01,Garrafeira Nacional
BR Monte Peceguinha,2.02,l,5.3364,2026-06-01,Garrafeira Nacional
BR Papa Figos,0.81,l,3.4533,2026-06-01,Garrafeira Nacional
BR Qta Lemos D.Paulette,0.65,l,14.727,2026-06-01,Garrafeira Nacional
BR Ribeiro Santo Encruzado,2.99,l,3.9261,2026-06-01,Garrafeira Nacional
BR Valle do Nídeo,0.93,l,2.197,2026-06-01,Garrafeira Nacional
BR Volupia,0.75,l,3.7148,2026-06-01,Garrafeira Nacional
Bacalhau desfiado,2.23,kg,27.6344,2026-06-01,Peixaria do Porto
Bacon,0.04,kg,9.9576,2026-06-01,Talho Central
Batata,12.33,kg,1.1226,2026-06-01,Hortofrutícola Vale Verde
Batata a murro,0.83,kg,1.1144,2026-06-01,Hortofrutícola Vale Verde
Batata cozida,9.14,kg,1.0813,2026-06-01,Hortofrutícola Vale Verde
Batata frita,1.56,kg,1.2196,2026-06-01,Hortofrutícola Vale Verde
Batata palha,1.54,kg,1.3646,2026-06-01,Hortofrutícola Vale Verde
Beirão,0.04,l,24.6525,2026-06-01,Bebidas & Companhia
Bife de atum,1.55,kg,21.9358,2026-06-01,Peixaria do Porto
Bife de vaca,0.15,kg,16.0619,2026-06-01,Talho Central
Black Label,0.04,l,48.404,2026-06-01,Bebidas & Companhia
Bolo de chocolate,0.29,kg,6.8824,2026-06-01,Mercearia Atlântico
Café moído,0.88,kg,21.0891,2026-06-01,Mercearia Atlântico
Camarão,0.81,kg,19.0337,2026-06-01,Peixaria do Porto
Camarão da costa,1.05,kg,31.2888,2026-06-01,Peixaria do Porto
Canela,0.03,kg,18.3925,2026-06-01,Mercearia Atlântico
Cebola,0.7,kg,0.9367,2026-06-01,Hortofrutícola Vale Verde
Cenoura,0.08,kg,1.0424,2026-06-01,Hortofrutícola Vale Verde
Chocolate,0.05,kg,9.6939,2026-06-01,Mercearia Atlântico
Chouriço,0.15,kg,10.3325,2026-06-01,Talho Central
Coca-Cola,6.34,l,2.0979,2026-06-01,Distribuidora Refrescos Lda
Coentros,0.04,kg,9.9642,2026-06-01,Hortofrutícola Vale Verde
Compal Néctar,0.34,l,3.6895,2026-06-01,Distribuidora Refrescos Lda
ES Ortigão Nektar,1.37,l,2.3999,2026-06-01,Garrafeira Nacional
ES S. Domingos Extra Reserva,0.81,l,3.7712,2026-06-01,Garrafeira Nacional
Entrecôte,1.7,kg,18.7364,2026-06-01,Talho Central
Filetes de peixe galo,14.66,kg,20.0391,2026-06-01,Peixaria do Porto
Filetes de polvo,7.45,kg,15.1101,2026-06-01,Peixaria do Porto
Frango,0.09,kg,5.3759,2026-06-01,Talho Central
Fruta da época,0.71,kg,2.1874,2026-06-01,Hortofrutícola Vale Verde
Ingredientes variados,1.55,kg,4.9516,2026-06-01,Mercearia Atlântico
Legumes,1.02,kg,1.7305,2026-06-01,Hortofrutícola Vale Verde
Legumes salteados,0.85,kg,1.7269,2026-06-01,Hortofrutícola Vale Verde
Legumes variados,1.03,kg,1.7795,2026-06-01,Hortofrutícola Vale Verde
Limão,0.24,kg,2.3822,2026-06-01,Hortofrutícola Vale Verde
Lombo de bacalhau,1.2,kg,32.4911,2026-06-01,Peixaria do Porto
Lombo de vaca,0.54,kg,18.8909,2026-06-01,Talho Central
Maionese,0.02,kg,3.752,2026-06-01,Mercearia Atlântico
Malagueta,0.01,kg,7.5239,2026-06-01,Hortofrutícola Vale Verde
Manteiga,1.1,kg,7.3591,2026-06-01,Lacticínios Serra
Marisco,0.33,kg,16.5965,2026-06-01,Peixaria do Porto
Maçã,1.04,kg,1.7799,2026-06-01,Hortofrutícola Vale Verde
Melão,0.5,kg,1.5395,2026-06-01,Hortofrutícola Vale Verde
Mini Sagres,1.0,l,3.0143,2026-06-01,Distribuidora Refrescos Lda
Molho,0.2,l,5.7712,2026-06-01,Mercearia Atlântico
Molho de frutos vermelhos,0.03,l,5.8921,2026-06-01,Mercearia Atlântico
Mostarda,0.01,kg,3.5528,2026-06-01,Mercearia Atlântico
Ovo,1.0,unit,0.2405,2026-06-01,Lacticínios Serra
Ovos,35.0,unit,0.2314,2026-06-01,Lacticínios Serra
Pato desfiado,0.54,kg,13.471,2026-06-01,Talho Central
Peito de pato,0.28,kg,12.7201,2026-06-01,Talho Central
Peixe inteiro,6.72,kg,13.7772,2026-06-01,Peixaria do Porto
Peixe variado,2.2,kg,11.5053,2026-06-01,Peixaria do Porto
Pera,1.13,kg,2.1218,2026-06-01,Hortofrutícola Vale Verde
Picanha,0.36,kg,17.6344,2026-06-01,Talho Central
Pimento,0.11,kg,2.421,2026-06-01,Hortofrutícola Vale Verde
Polvo,1.69,kg,14.152,2026-06-01,Peixaria do Porto
Posta de vaca,0.48,kg,17.8968,2026-06-01,Talho Central
Presunto,0.33,kg,21.6803,2026-06-01,Talho Central
"Pudim (leite, ovos, açúcar)",0.59,kg,4.635,2026-06-01,Mercearia Atlântico
Pão,5.46,kg,3.623,2026-06-01,Padaria Forno Antigo
Pão de forma,0.11,kg,4.4099,2026-06-01,Padaria Forno Antigo
RS Titular Rosé,0.95,l,2.5171,2026-06-01,Garrafeira Nacional
Rabo de boi,0.33,kg,10.8029,2026-06-01,Talho Central
Rabo de boi desfiado,0.68,kg,11.2833,2026-06-01,Talho Central
Sangria 1.5L,5.49,l,5.5998,2026-06-01,Distribuidora Refrescos Lda
Sangria 1L,2.02,l,5.6186,2026-06-01,Distribuidora Refrescos Lda
Seven Up,0.31,l,2.0855,2026-06-01,Distribuidora Refrescos Lda
TT Burmester meia gr.,0.46,l,2.58,2026-06-01,Garrafeira Nacional
TT S. Domingos Reserva,0.89,l,3.9599,2026-06-01,Garrafeira Nacional
Tamboril,1.36,kg,16.9105,2026-06-01,Peixaria do Porto
Tomate,1.79,kg,1.7852,2026-06-01,Hortofrutícola Vale Verde
V Muralhas,1.8,l,1.8632,2026-06-01,Garrafeira Nacional
Vinagre,0.01,l,1.8738,2026-06-01,Mercearia Atlântico
Vinho 0.5L,3.04,l,2.6396,2026-06-01,Distribuidora Refrescos Lda
Vinho 1L,3.78,l,0.7548,2026-06-01,Distribuidora Refrescos Lda
Vinho Branco da casa (copo),0.76,l,7.9329,2026-06-01,Distribuidora Refrescos Lda
Vinho Menu,4.49,l,2.4496,2026-06-01,Distribuidora Refrescos Lda
Vinho Tinto da casa (copo),0.7,l,8.3187,2026-06-01,Distribuidora Refrescos Lda
Vinho branco,0.31,l,3.1181,2026-06-01,Mercearia Atlântico
Vinho tinto,0.83,l,2.9556,2026-06-01,Mercearia Atlântico
Água 0.5L,23.67,l,1.1236,2026-06-01,Distribuidora Refrescos Lda
Água c/gás,0.27,l,2.5455,2026-06-01,Distribuidora Refrescos Lda
Alface,0.77,kg,1.4431,2026-06-08,Hortofrutícola Vale Verde
Alheira,0.12,kg,9.8148,2026-06-08,Talho Central
Alho,0.64,kg,4.78,2026-06-08,Hortofrutícola Vale Verde
Ameijoas,5.39,kg,14.6814,2026-06-08,Peixaria do Porto
Arroz,3.12,kg,1.5949,2026-06-08,Mercearia Atlântico
Azeite,3.25,l,6.0372,2026-06-08,Mercearia Atlântico
Azeitonas,2.75,kg,4.6581,2026-06-08,Mercearia Atlântico
Açúcar,0.32,kg,1.2274,2026-06-08,Mercearia Atlântico
BR Dona Matilde,3.22,l,3.7611,2026-06-08,Garrafeira Nacional
BR Luis Pato Maria Gomes,3.9,l,2.8532,2026-06-08,Garrafeira Nacional
BR Luis Pato Vinhas Velhas,2.36,l,4.1518,2026-06-08,Garrafeira Nacional
BR Planalto,0.7,l,2.13,2026-06-08,Garrafeira Nacional
BR Ribeiro Santo Encruzado,3.73,l,4.1875,2026-06-08,Garrafeira Nacional
BR Vinha Grande,0.89,l,4.688,2026-06-08,Garrafeira Nacional
Bacalhau desfiado,3.18,kg,25.2568,2026-06-08,Peixaria do Porto
Bacon,0.04,kg,9.6463,2026-06-08,Talho Central
Batata,9.26,kg,1.1219,2026-06-08,Hortofrutícola Vale Verde
Batata a murro,2.7,kg,1.0299,2026-06-08,Hortofrutícola Vale Verde
Batata cozida,4.53,kg,1.0576,2026-06-08,Hortofrutícola Vale Verde
Batata frita,2.85,kg,1.166,2026-06-08,Hortofrutícola Vale Verde
Batata palha,1.85,kg,1.3072,2026-06-08,Hortofrutícola Vale Verde
Bife de atum,0.39,kg,22.3831,2026-06-08,Peixaria do Porto
CRF-Reserva,0.05,l,29.011,2026-06-08,Bebidas & Companhia
Café moído,1.87,kg,22.3783,2026-06-08,Mercearia Atlântico
Camarão,1.29,kg,19.6888,2026-06-08,Peixaria do Porto
Camarão da costa,1.64,kg,29.7607,2026-06-08,Peixaria do Porto
Canela,0.03,kg,17.1777,2026-06-08,Mercearia Atlântico
Carne de vaca,0.77,kg,13.687,2026-06-08,Talho Central
Cebola,0.97,kg,0.9724,2026-06-08,Hortofrutícola Vale Verde
Cenoura,0.24,kg,1.0887,2026-06-08,Hortofrutícola Vale Verde
Coca-Cola,6.04,l,2.1138,2026-06-08,Distribuidora Refrescos Lda
Coentros,0.1,kg,9.2091,2026-06-08,Hortofrutícola Vale Verde
Conquilhas,0.17,kg,11.483,2026-06-08,Peixaria do Porto
Coxa de pato,0.87,kg,11.5123,2026-06-08,Talho Central
ES S. Domingos Extra Reserva,0.81,l,3.4731,2026-06-08,Garrafeira Nacional
Entrecosto de porco,1.56,kg,8.2007,2026-06-08,Talho Central
Entrecôte,1.21,kg,20.1064,2026-06-08,Talho Central
Filetes de peixe galo,10.19,kg,19.4122,2026-06-08,Peixaria do Porto
Filetes de polvo,2.38,kg,15.2999,2026-06-08,Peixaria do Porto
Frango,0.09,kg,5.2567,2026-06-08,Talho Central
Gelado,0.23,kg,5.9113,2026-06-08,Mercearia Atlântico
Ingredientes variados,4.09,kg,4.9268,2026-06-08,Mercearia Atlântico
Jameson,0.04,l,30.9803,2026-06-08,Bebidas & Companhia
Legumes,1.02,kg,1.8891,2026-06-08,Hortofrutícola Vale Verde
Legumes salteados,0.21,kg,1.8604,2026-06-08,Hortofrutícola Vale Verde
Legumes variados,0.77,kg,1.8177,2026-06-08,Hortofrutícola Vale Verde
Limão,0.22,kg,2.4604,2026-06-08,Hortofrutícola Vale Verde
Lombo de bacalhau,3.6,kg,34.84,2026-06-08,Peixaria do Porto
Lombo de vaca,0.72,kg,19.3079,2026-06-08,Talho Central
Maionese,0.02,kg,3.5734,2026-06-08,Mercearia Atlântico
Malagueta,0.02,kg,7.3068,2026-06-08,Hortofrutícola Vale Verde
Manteiga,1.49,kg,7.3467,2026-06-08,Lacticínios Serra
Martini,0.05,l,18.8749,2026-06-08,Bebidas & Companhia
Maçã,1.91,kg,1.8342,2026-06-08,Hortofrutícola Vale Verde
Mini Sagres,3.74,l,2.7962,2026-06-08,Distribuidora Refrescos Lda
Molho,0.14,l,6.1249,2026-06-08,Mercearia Atlântico
Molho de frutos vermelhos,0.1,l,5.957,2026-06-08,Mercearia Atlântico
Mostarda,0.04,kg,3.6826,2026-06-08,Mercearia Atlântico
Ovos,45.0,unit,0.2299,2026-06-08,Lacticínios Serra
Peito de pato,0.85,kg,12.7229,2026-06-08,Talho Central
Peixe inteiro,5.37,kg,13.9677,2026-06-08,Peixaria do Porto
Peixe variado,1.45,kg,12.4777,2026-06-08,Peixaria do Porto
Pera,0.75,kg,2.1166,2026-06-08,Hortofrutícola Vale Verde
Picanha,1.45,kg,18.808,2026-06-08,Talho Central
Polvo,2.86,kg,14.4111,2026-06-08,Peixaria do Porto
Polvo cozido,0.46,kg,14.7694,2026-06-08,Peixaria do Porto
Posta de vaca,0.96,kg,17.7652,2026-06-08,Talho Central
Presunto,0.15,kg,22.3954,2026-06-08,Talho Central
"Pudim (leite, ovos, açúcar)",0.29,kg,4.7693,2026-06-08,Mercearia Atlântico
Pão,6.68,kg,3.542,2026-06-08,Padaria Forno Antigo
Pão de forma,0.11,kg,4.3485,2026-06-08,Padaria Forno Antigo
RS Papa Figos,0.79,l,3.2956,2026-06-08,Garrafeira Nacional
Rabo de boi,0.98,kg,10.7978,2026-06-08,Talho Central
Salsa,0.01,kg,9.5866,2026-06-08,Hortofrutícola Vale Verde
Sangria 1.5L,1.83,l,5.4025,2026-06-08,Distribuidora Refrescos Lda
Sangria 1L,1.01,l,5.799,2026-06-08,Distribuidora Refrescos Lda
Seven Up,0.92,l,2.0878,2026-06-08,Distribuidora Refrescos Lda
TT Dona Matilde Res,0.91,l,9.1355,2026-06-08,Garrafeira Nacional
TT Duvalley,0.86,l,2.5748,2026-06-08,Garrafeira Nacional
TT Monte Peceguinha,0.76,l,5.5299,2026-06-08,Garrafeira Nacional
TT Papa Figos,4.11,l,3.1931,2026-06-08,Garrafeira Nacional
TT V.Nídeo Reserva,1.79,l,2.4819,2026-06-08,Garrafeira Nacional
Tamboril,1.36,kg,16.9889,2026-06-08,Peixaria do Porto
Tomate,1.98,kg,1.8665,2026-06-08,Hortofrutícola Vale Verde
V Regueiro,0.86,l,3.7213,2026-06-08,Garrafeira Nacional
Vinagre,0.06,l,1.7949,2026-06-08,Mercearia Atlântico
Vinho 0.5L,6.95,l,2.6215,2026-06-08,Distribuidora Refrescos Lda
Vinho 1L,2.52,l,0.7423,2026-06-08,Distribuidora Refrescos Lda
Vinho Branco da casa (copo),0.63,l,7.7396,2026-06-08,Distribuidora Refrescos Lda
Vinho Menu,3.59,l,2.5466,2026-06-08,Distribuidora Refrescos Lda
Vinho branco,0.32,l,2.888,2026-06-08,Mercearia Atlântico
Vinho tinto,0.73,l,2.8619,2026-06-08,Mercearia Atlântico
Água 0.5L,22.66,l,1.1824,2026-06-08,Distribuidora Refrescos Lda
Água c/gás,6.48,l,2.4951,2026-06-08,Distribuidora Refrescos Lda
Alface,0.09,kg,1.3965,2026-06-15,Hortofrutícola Vale Verde
Alheira,0.48,kg,9.223,2026-06-15,Talho Central
Alho,0.38,kg,4.7947,2026-06-15,Hortofrutícola Vale Verde
Ameijoas,2.92,kg,14.4137,2026-06-15,Peixaria do Porto
Arroz,2.32,kg,1.5565,2026-06-15,Mercearia Atlântico
Azeite,2.53,l,6.2935,2026-06-15,Mercearia Atlântico
Azeitonas,2.06,kg,4.5641,2026-06-15,Mercearia Atlântico
Açúcar,0.59,kg,1.1831,2026-06-15,Mercearia Atlântico
BR Monte Peceguinha,0.67,l,5.4471,2026-06-15,Garrafeira Nacional
BR Papa Figos,1.62,l,3.3268,2026-06-15,Garrafeira Nacional
BR Planalto,0.7,l,2.3456,2026-06-15,Garrafeira Nacional
BR Ribeiro Santo Encruzado,4.48,l,4.0335,2026-06-15,Garrafeira Nacional
BR V. Nídeo SauvignonBlanc,1.49,l,3.2033,2026-06-15,Garrafeira Nacional
Bacalhau desfiado,4.13,kg,26.473,2026-06-15,Peixaria do Porto
Batata,8.67,kg,1.0613,2026-06-15,Hortofrutícola Vale Verde
Batata a murro,0.62,kg,1.0527,2026-06-15,Hortofrutícola Vale Verde
Batata cozida,2.72,kg,1.09,2026-06-15,Hortofrutícola Vale Verde
Batata frita,2.02,kg,1.1701,2026-06-15,Hortofrutícola Vale Verde
Batata palha,2.46,kg,1.279,2026-06-15,Hortofrutícola Vale Verde
Bife de atum,1.17,kg,21.3085,2026-06-15,Peixaria do Porto
Bife de vaca,0.45,kg,16.8939,2026-06-15,Talho Central
Bolo de chocolate,0.29,kg,6.8885,2026-06-15,Mercearia Atlântico
CRF-Reserva,0.09,l,30.6771,2026-06-15,Bebidas & Companhia
Café moído,1.77,kg,22.4037,2026-06-15,Mercearia Atlântico
Camarão,1.05,kg,19.2412,2026-06-15,Peixaria do Porto
Camarão da costa,1.34,kg,28.9014,2026-06-15,Peixaria do Porto
Canela,0.04,kg,17.1197,2026-06-15,Mercearia Atlântico
Carne de vaca,1.03,kg,14.4796,2026-06-15,Talho Central
Cebola,0.85,kg,0.9759,2026-06-15,Hortofrutícola Vale Verde
Cenoura,0.16,kg,1.0544,2026-06-15,Hortofrutícola Vale Verde
Chocolate,0.05,kg,10.0142,2026-06-15,Mercearia Atlântico
Coca-Cola,2.42,l,2.2241,2026-06-15,Distribuidora Refrescos Lda
Coentros,0.06,kg,9.6006,2026-06-15,Hortofrutícola Vale Verde
Compal Néctar,0.17,l,3.7252,2026-06-15,Distribuidora Refrescos Lda
Coxa de pato,0.58,kg,12.2302,2026-06-15,Talho Central
E S.Domingos,2.38,l,3.7929,2026-06-15,Garrafeira Nacional
ES Quinta Monteirinhos,2.84,l,5.1199,2026-06-15,Garrafeira Nacional
Entrecosto de porco,0.97,kg,8.0376,2026-06-15,Talho Central
Entrecôte,1.45,kg,20.1354,2026-06-15,Talho Central
Filetes de peixe galo,9.73,kg,19.6763,2026-06-15,Peixaria do Porto
Filetes de polvo,1.94,kg,14.9321,2026-06-15,Peixaria do Porto
Gelado,0.46,kg,6.1969,2026-06-15,Mercearia Atlântico
Ingredientes variados,1.44,kg,4.5827,2026-06-15,Mercearia Atlântico
Legumes,0.79,kg,1.7274,2026-06-15,Hortofrutícola Vale Verde
Legumes salteados,0.63,kg,1.737,2026-06-15,Hortofrutícola Vale Verde
Legumes variados,2.05,kg,1.7635,2026-06-15,Hortofrutícola Vale Verde
Leite,0.65,l,1.0732,2026-06-15,Lacticínios Serra
Limão,0.11,kg,2.4794,2026-06-15,Hortofrutícola Vale Verde
Lombo de bacalhau,0.4,kg,33.0035,2026-06-15,Peixaria do Porto
Lombo de vaca,0.36,kg,18.8265,2026-06-15,Talho Central
Malagueta,0.01,kg,7.2735,2026-06-15,Hortofrutícola Vale Verde
Manteiga,1.05,kg,6.9484,2026-06-15,Lacticínios Serra
Marisco variado,0.42,kg,17.2303,2026-06-15,Peixaria do Porto
Maçã,0.52,kg,1.8461,2026-06-15,Hortofrutícola Vale Verde
Melão,0.25,kg,1.5748,2026-06-15,Hortofrutícola Vale Verde
Molho,0.17,l,5.7269,2026-06-15,Mercearia Atlântico
Mostarda,0.08,kg,3.6347,2026-06-15,Mercearia Atlântico
Nordés,0.05,l,54.8875,2026-06-15,Bebidas & Companhia
Ovo,3.0,unit,0.2329,2026-06-15,Lacticínios Serra
Ovos,63.0,unit,0.2342,2026-06-15,Lacticínios Serra
Peixe inteiro,2.69,kg,14.5895,2026-06-15,Peixaria do Porto
Peixe variado,1.13,kg,12.3184,2026-06-15,Peixaria do Porto
Pera,2.26,kg,2.0788,2026-06-15,Hortofrutícola Vale Verde
Picanha,0.72,kg,18.5261,2026-06-15,Talho Central
Polvo,1.3,kg,13.7545,2026-06-15,Peixaria do Porto
Polvo cozido,0.46,kg,14.7644,2026-06-15,Peixaria do Porto
Presunto,0.28,kg,22.6611,2026-06-15,Talho Central
"Pudim (leite, ovos, açúcar)",0.2,kg,4.8189,2026-06-15,Mercearia Atlântico
Pão,4.95,kg,3.5055,2026-06-15,Padaria Forno Antigo
RS Titular Rosé,0.95,l,2.6725,2026-06-15,Garrafeira Nacional
Rabo de boi,0.66,kg,11.0,2026-06-15,Talho Central
Salsa,0.01,kg,9.8935,2026-06-15,Hortofrutícola Vale Verde
Saqueta de chá,2.0,unit,0.0927,2026-06-15,Mercearia Atlântico
TT Dona Matilde,0.89,l,3.7432,2026-06-15,Garrafeira Nacional
TT Monte Peceguinha,0.76,l,5.85,2026-06-15,Garrafeira Nacional
TT Papa Figos,0.82,l,3.3833,2026-06-15,Garrafeira Nacional
TT V.Nídeo Reserva,1.79,l,2.6697,2026-06-15,Garrafeira Nacional
Tamboril,1.13,kg,16.5759,2026-06-15,Peixaria do Porto
Tomate,1.11,kg,1.8695,2026-06-15,Hortofrutícola Vale Verde
V Muralhas,0.9,l,1.9399,2026-06-15,Garrafeira Nacional
Vinagre,0.03,l,1.8707,2026-06-15,Mercearia Atlântico
Vinho 0.5L,6.52,l,2.7271,2026-06-15,Distribuidora Refrescos Lda
Vinho 1L,7.55,l,0.765,2026-06-15,Distribuidora Refrescos Lda
Vinho Branco da casa (copo),0.76,l,8.3797,2026-06-15,Distribuidora Refrescos Lda
Vinho Menu,1.05,l,2.507,2026-06-15,Distribuidora Refrescos Lda
Vinho Tinto da casa (copo),0.18,l,7.9851,2026-06-15,Distribuidora Refrescos Lda
Vinho branco,0.21,l,2.895,2026-06-15,Mercearia Atlântico
Vinho tinto,1.66,l,2.9756,2026-06-15,Mercearia Atlântico
Água 0.33L,0.4,l,1.465,2026-06-15,Distribuidora Refrescos Lda
Água 0.5L,16.62,l,1.1563,2026-06-15,Distribuidora Refrescos Lda
Água c/gás,4.05,l,2.4928,2026-06-15,Distribuidora Refrescos Lda
Alface,0.47,kg,1.4994,2026-06-22,Hortofrutícola Vale Verde
Alheira,0.12,kg,9.26,2026-06-22,Talho Central
Alho,0.46,kg,4.6034,2026-06-22,Hortofrutícola Vale Verde
Ameijoas,3.37,kg,14.6165,2026-06-22,Peixaria do Porto
Arroz,1.04,kg,1.4897,2026-06-22,Mercearia Atlântico
Azeite,2.92,l,6.0944,2026-06-22,Mercearia Atlântico
Azeitonas,1.81,kg,4.8132,2026-06-22,Mercearia Atlântico
Açúcar,0.47,kg,1.21,2026-06-22,Mercearia Atlântico
BR Burmester meia gr.,0.89,l,2.5244,2026-06-22,Garrafeira Nacional
BR Dona Matilde,4.03,l,3.8919,2026-06-22,Garrafeira Nacional
BR Monte Peceguinha,0.67,l,5.6723,2026-06-22,Garrafeira Nacional
BR Papa Figos,1.62,l,3.3451,2026-06-22,Garrafeira Nacional
BR Ribeiro Santo Encruzado,2.24,l,4.1663,2026-06-22,Garrafeira Nacional
BR V. Nídeo SauvignonBlanc,0.74,l,3.1814,2026-06-22,Garrafeira Nacional
BR Vinha Grande,3.55,l,4.9838,2026-06-22,Garrafeira Nacional
BR Volupia,0.75,l,3.4904,2026-06-22,Garrafeira Nacional
Bacalhau desfiado,3.18,kg,26.499,2026-06-22,Peixaria do Porto
Batata,11.94,kg,1.09,2026-06-22,Hortofrutícola Vale Verde
Batata a murro,1.04,kg,1.0993,2026-06-22,Hortofrutícola Vale Verde
Batata cozida,3.53,kg,1.128,2026-06-22,Hortofrutícola Vale Verde
Batata frita,3.58,kg,1.2281,2026-06-22,Hortofrutícola Vale Verde
Batata palha,1.85,kg,1.334,2026-06-22,Hortofrutícola Vale Verde
Beirão,0.07,l,24.4572,2026-06-22,Bebidas & Companhia
Bife de atum,0.97,kg,22.3073,2026-06-22,Peixaria do Porto
Black Label,0.08,l,46.6164,2026-06-22,Bebidas & Companhia
CRF-Reserva,0.09,l,29.3316,2026-06-22,Bebidas & Companhia
Café moído,2.79,kg,21.7973,2026-06-22,Mercearia Atlântico
Camarão,0.66,kg,18.8901,2026-06-22,Peixaria do Porto
Camarão da costa,0.6,kg,30.1899,2026-06-22,Peixaria do Porto
Canela,0.04,kg,18.1533,2026-06-22,Mercearia Atlântico
Carne de vaca,0.26,kg,14.8053,2026-06-22,Talho Central
Cebola,0.58,kg,0.9382,2026-06-22,Hortofrutícola Vale Verde
Cenoura,0.08,kg,1.1287,2026-06-22,Hortofrutícola Vale Verde
Coca-Cola,6.34,l,2.2613,2026-06-22,Distribuidora Refrescos Lda
Coentros,0.06,kg,10.0196,2026-06-22,Hortofrutícola Vale Verde
Compal Néctar,0.17,l,3.4259,2026-06-22,Distribuidora Refrescos Lda
Entrecosto de porco,0.97,kg,8.0248,2026-06-22,Talho Central
Entrecôte,3.64,kg,18.3367,2026-06-22,Talho Central
Filetes de peixe galo,13.85,kg,18.6106,2026-06-22,Peixaria do Porto
Filetes de polvo,3.13,kg,15.4025,2026-06-22,Peixaria do Porto
Fruta da época,0.18,kg,2.167,2026-06-22,Hortofrutícola Vale Verde
Gelado,1.14,kg,6.1975,2026-06-22,Mercearia Atlântico
Gordons,0.03,l,29.7593,2026-06-22,Bebidas & Companhia
Ingredientes variados,1.55,kg,4.7368,2026-06-22,Mercearia Atlântico
Legumes,1.69,kg,1.8196,2026-06-22,Hortofrutícola Vale Verde
Legumes salteados,0.53,kg,1.8168,2026-06-22,Hortofrutícola Vale Verde
Legumes variados,3.02,kg,1.8009,2026-06-22,Hortofrutícola Vale Verde
Leite,0.65,l,1.0697,2026-06-22,Lacticínios Serra
Limão,0.09,kg,2.4117,2026-06-22,Hortofrutícola Vale Verde
Lombo de bacalhau,0.4,kg,34.8532,2026-06-22,Peixaria do Porto
Lombo de vaca,0.9,kg,18.6657,2026-06-22,Talho Central
Malagueta,0.01,kg,7.1613,2026-06-22,Hortofrutícola Vale Verde
Manteiga,0.94,kg,7.2142,2026-06-22,Lacticínios Serra
Maçã,2.44,kg,1.7997,2026-06-22,Hortofrutícola Vale Verde
Molho,0.43,l,5.7858,2026-06-22,Mercearia Atlântico
Molho de frutos vermelhos,0.03,l,6.0514,2026-06-22,Mercearia Atlântico
Mostarda,0.01,kg,3.5558,2026-06-22,Mercearia Atlântico
Ovos,45.0,unit,0.2304,2026-06-22,Lacticínios Serra
Peito de pato,0.28,kg,13.8047,2026-06-22,Talho Central
Peixe inteiro,1.34,kg,14.2101,2026-06-22,Peixaria do Porto
Peixe variado,2.41,kg,11.533,2026-06-22,Peixaria do Porto
Pera,0.57,kg,2.0748,2026-06-22,Hortofrutícola Vale Verde
Picanha,0.54,kg,18.5683,2026-06-22,Talho Central
Polvo,1.82,kg,13.852,2026-06-22,Peixaria do Porto
Porto 10 anos Tawny,0.07,l,53.3701,2026-06-22,Bebidas & Companhia
Posta de vaca,0.96,kg,18.2271,2026-06-22,Talho Central
Presunto,0.15,kg,21.0273,2026-06-22,Talho Central
"Pudim (leite, ovos, açúcar)",0.68,kg,4.9308,2026-06-22,Mercearia Atlântico
Pão,4.64,kg,3.6804,2026-06-22,Padaria Forno Antigo
RS Papa Figos,1.58,l,3.198,2026-06-22,Garrafeira Nacional
Rabo de boi,0.33,kg,10.9977,2026-06-22,Talho Central
Rabo de boi desfiado,0.6,kg,10.315,2026-06-22,Talho Central
Sangria 1.5L,1.83,l,5.6047,2026-06-22,Distribuidora Refrescos Lda
Saqueta de chá,4.0,unit,0.0991,2026-06-22,Mercearia Atlântico
Seven Up,0.31,l,2.0754,2026-06-22,Distribuidora Refrescos Lda
TT Dona Matilde,0.89,l,3.8117,2026-06-22,Garrafeira Nacional
TT Papa Figos,1.65,l,3.4348,2026-06-22,Garrafeira Nacional
TT Ribeiro Santo Res,0.67,l,3.0665,2026-06-22,Garrafeira Nacional
TT V.Nídeo Reserva,0.89,l,2.6622,2026-06-22,Garrafeira Nacional
Tamboril,0.23,kg,17.0018,2026-06-22,Peixaria do Porto
Tomate,1.43,kg,1.8826,2026-06-22,Hortofrutícola Vale Verde
V Muralhas,0.9,l,1.8218,2026-06-22,Garrafeira Nacional
V Regueiro,0.86,l,3.9317,2026-06-22,Garrafeira Nacional
Vinagre,0.03,l,1.7372,2026-06-22,Mercearia Atlântico
Vinho 0.5L,4.78,l,2.7918,2026-06-22,Distribuidora Refrescos Lda
Vinho 1L,3.78,l,0.7381,2026-06-22,Distribuidora Refrescos Lda
Vinho Menu,1.05,l,2.625,2026-06-22,Distribuidora Refrescos Lda
Vinho Tinto da casa (copo),0.35,l,8.2693,2026-06-22,Distribuidora Refrescos Lda
Vinho branco,0.18,l,2.918,2026-06-22,Mercearia Atlântico
Vinho tinto,0.45,l,2.9515,2026-06-22,Mercearia Atlântico
Água 0.5L,20.14,l,1.1546,2026-06-22,Distribuidora Refrescos Lda
Água c/gás,1.35,l,2.509,2026-06-22,Distribuidora Refrescos Lda
Alface,0.56,kg,1.4564,2026-06-29,Hortofrutícola Vale Verde
Alheira,0.24,kg,9.5967,2026-06-29,Talho Central
Alho,0.79,kg,4.7698,2026-06-29,Hortofrutícola Vale Verde
Ameijoas,7.64,kg,14.0101,2026-06-29,Peixaria do Porto
Arroz,3.07,kg,1.6333,2026-06-29,Mercearia Atlântico
Azeite,4.01,l,5.8499,2026-06-29,Mercearia Atlântico
Azeitonas,2.73,kg,4.7501,2026-06-29,Mercearia Atlântico
Açúcar,0.65,kg,1.1784,2026-06-29,Mercearia Atlântico
BR Burmester meia gr.,0.45,l,2.5367,2026-06-29,Garrafeira Nacional
BR GALHARDINI,1.82,l,2.425,2026-06-29,Garrafeira Nacional
BR Monte Peceguinha,3.36,l,5.5741,2026-06-29,Garrafeira Nacional
BR Papa Figos,1.62,l,3.1437,2026-06-29,Garrafeira Nacional
BR Ribeiro Santo Encruzado,5.23,l,4.0964,2026-06-29,Garrafeira Nacional
BR Titular Colheita,0.72,l,2.6021,2026-06-29,Garrafeira Nacional
BR Valle do Nídeo,3.71,l,2.2286,2026-06-29,Garrafeira Nacional
Bacalhau desfiado,1.59,kg,27.0514,2026-06-29,Peixaria do Porto
Batata,14.21,kg,1.0967,2026-06-29,Hortofrutícola Vale Verde
Batata a murro,2.91,kg,1.0368,2026-06-29,Hortofrutícola Vale Verde
Batata cozida,5.25,kg,1.047,2026-06-29,Hortofrutícola Vale Verde
Batata frita,3.31,kg,1.2236,2026-06-29,Hortofrutícola Vale Verde
Batata palha,1.08,kg,1.3222,2026-06-29,Hortofrutícola Vale Verde
Beirão,0.04,l,23.9146,2026-06-29,Bebidas & Companhia
Bife de atum,1.75,kg,22.6704,2026-06-29,Peixaria do Porto
Bife de vaca,0.15,kg,17.0187,2026-06-29,Talho Central
Buldog,0.04,l,55.1698,2026-06-29,Bebidas & Companhia
Café moído,0.96,kg,21.7244,2026-06-29,Mercearia Atlântico
Camarão,0.9,kg,19.6819,2026-06-29,Peixaria do Porto
Camarão da costa,1.19,kg,30.1356,2026-06-29,Peixaria do Porto
Canela,0.06,kg,17.6291,2026-06-29,Mercearia Atlântico
Carne de vaca,0.51,kg,15.0372,2026-06-29,Talho Central
Cebola,0.85,kg,0.9738,2026-06-29,Hortofrutícola Vale Verde
Cenoura,0.16,kg,1.1008,2026-06-29,Hortofrutícola Vale Verde
Coca-Cola,8.46,l,2.2601,2026-06-29,Distribuidora Refrescos Lda
Coentros,0.14,kg,9.4461,2026-06-29,Hortofrutícola Vale Verde
Compal Néctar,0.34,l,3.464,2026-06-29,Distribuidora Refrescos Lda
Coxa de pato,1.16,kg,11.674,2026-06-29,Talho Central
Entrecosto de porco,1.56,kg,8.5007,2026-06-29,Talho Central
Entrecôte,2.91,kg,18.2475,2026-06-29,Talho Central
Filetes de peixe galo,15.46,kg,18.882,2026-06-29,Peixaria do Porto
Filetes de polvo,4.97,kg,15.0789,2026-06-29,Peixaria do Porto
Fruta da época,0.88,kg,2.1494,2026-06-29,Hortofrutícola Vale Verde
Gelado,0.57,kg,6.1916,2026-06-29,Mercearia Atlântico
Ingredientes variados,2.55,kg,4.9614,2026-06-29,Mercearia Atlântico
Legumes,1.13,kg,1.7732,2026-06-29,Hortofrutícola Vale Verde
Legumes salteados,0.95,kg,1.7128,2026-06-29,Hortofrutícola Vale Verde
Legumes variados,2.23,kg,1.7824,2026-06-29,Hortofrutícola Vale Verde
Leite,0.22,l,1.0447,2026-06-29,Lacticínios Serra
Limão,0.2,kg,2.3701,2026-06-29,Hortofrutícola Vale Verde
Lombo de bacalhau,3.2,kg,32.0586,2026-06-29,Peixaria do Porto
Lombo de vaca,0.18,kg,18.6418,2026-06-29,Talho Central
Malagueta,0.01,kg,7.4353,2026-06-29,Hortofrutícola Vale Verde
Manteiga,1.54,kg,6.8587,2026-06-29,Lacticínios Serra
Marisco variado,0.42,kg,16.8728,2026-06-29,Peixaria do Porto
Martini,0.14,l,18.2746,2026-06-29,Bebidas & Companhia
Maçã,2.44,kg,1.7324,2026-06-29,Hortofrutícola Vale Verde
Melão,0.5,kg,1.5281,2026-06-29,Hortofrutícola Vale Verde
Mini Sagres,1.25,l,2.9917,2026-06-29,Distribuidora Refrescos Lda
Molho,0.34,l,5.9672,2026-06-29,Mercearia Atlântico
Molho de frutos vermelhos,0.14,l,6.2359,2026-06-29,Mercearia Atlântico
Mostarda,0.03,kg,3.7622,2026-06-29,Mercearia Atlântico
Ovo,2.0,unit,0.2301,2026-06-29,Lacticínios Serra
Ovos,24.0,unit,0.2425,2026-06-29,Lacticínios Serra
Peito de pato,1.14,kg,13.5533,2026-06-29,Talho Central
Peixe inteiro,2.24,kg,13.7905,2026-06-29,Peixaria do Porto
Peixe variado,1.61,kg,12.1993,2026-06-29,Peixaria do Porto
Pera,2.08,kg,2.1399,2026-06-29,Hortofrutícola Vale Verde
Picanha,1.27,kg,17.8402,2026-06-29,Talho Central
Polvo,3.89,kg,15.048,2026-06-29,Peixaria do Porto
Polvo cozido,1.15,kg,14.6411,2026-06-29,Peixaria do Porto
Posta de vaca,0.48,kg,17.1568,2026-06-29,Talho Central
Presunto,0.26,kg,22.4928,2026-06-29,Talho Central
"Pudim (leite, ovos, açúcar)",1.07,kg,4.6292,2026-06-29,Mercearia Atlântico
Pão,7.19,kg,3.7534,2026-06-29,Padaria Forno Antigo
RS Papa Figos,1.58,l,3.3016,2026-06-29,Garrafeira Nacional
Rabo de boi,0.66,kg,10.568,2026-06-29,Talho Central
Rabo de boi desfiado,0.34,kg,10.7923,2026-06-29,Talho Central
Salsa,0.02,kg,9.8433,2026-06-29,Hortofrutícola Vale Verde
Sangria 1.5L,1.83,l,5.325,2026-06-29,Distribuidora Refrescos Lda
Sangria 1L,2.02,l,5.606,2026-06-29,Distribuidora Refrescos Lda
Saqueta de chá,1.0,unit,0.0966,2026-06-29,Mercearia Atlântico
Seven Up,0.31,l,2.276,2026-06-29,Distribuidora Refrescos Lda
TT Dona Matilde Res,1.82,l,9.1642,2026-06-29,Garrafeira Nacional
TT Ribeiro Santo Res,0.67,l,3.0167,2026-06-29,Garrafeira Nacional
TT S. Domingos Reserva,0.89,l,3.8252,2026-06-29,Garrafeira Nacional
TT V.Nídeo Reserva,1.79,l,2.5646,2026-06-29,Garrafeira Nacional
TT Vinha Grande,1.73,l,5.0546,2026-06-29,Garrafeira Nacional
Tamboril,1.13,kg,17.4342,2026-06-29,Peixaria do Porto
Tomate,1.96,kg,1.7999,2026-06-29,Hortofrutícola Vale Verde
V Muralhas,5.39,l,1.9502,2026-06-29,Garrafeira Nacional
Vinagre,0.09,l,1.7922,2026-06-29,Mercearia Atlântico
Vinho 0.5L,10.43,l,2.6171,2026-06-29,Distribuidora Refrescos Lda
Vinho 1L,3.78,l,0.7638,2026-06-29,Distribuidora Refrescos Lda
Vinho Branco da casa (copo),0.5,l,7.9954,2026-06-29,Distribuidora Refrescos Lda
Vinho Menu,2.1,l,2.4515,2026-06-29,Distribuidora Refrescos Lda
Vinho Tinto da casa (copo),0.53,l,7.6659,2026-06-29,Distribuidora Refrescos Lda
Vinho branco,0.46,l,3.0083,2026-06-29,Mercearia Atlântico
Vinho do Porto (dose),0.07,l,11.907,2026-06-29,Bebidas & Companhia
Vinho tinto,1.53,l,2.8575,2026-06-29,Mercearia Atlântico
Água 0.33L,0.4,l,1.507,2026-06-29,Distribuidora Refrescos Lda
Água 0.5L,24.17,l,1.1892,2026-06-29,Distribuidora Refrescos Lda
Água c/gás,8.92,l,2.5964,2026-06-29,Distribuidora Refrescos Lda
Aguardente,0.03,l,9.6528,2026-07-06,Mercearia Atlântico
Alface,0.19,kg,1.4447,2026-07-06,Hortofrutícola Vale Verde
Alheira,0.12,kg,9.9772,2026-07-06,Talho Central
Alho,0.83,kg,4.9174,2026-07-06,Hortofrutícola Vale Verde
Ameijoas,6.52,kg,14.3348,2026-07-06,Peixaria do Porto
Arroz,2.26,kg,1.5274,2026-07-06,Mercearia Atlântico
Azeite,4.38,l,6.1792,2026-07-06,Mercearia Atlântico
Azeitonas,2.56,kg,4.9635,2026-07-06,Mercearia Atlântico
Açúcar,0.4,kg,1.1878,2026-07-06,Mercearia Atlântico
BR Luis Pato Maria Gomes,1.56,l,2.6481,2026-07-06,Garrafeira Nacional
BR Luis Pato Vinhas Velhas,0.79,l,4.3448,2026-07-06,Garrafeira Nacional
BR Monte Peceguinha,2.02,l,5.8454,2026-07-06,Garrafeira Nacional
BR Papa Figos,0.81,l,3.1934,2026-07-06,Garrafeira Nacional
BR Piano Moscatel Galego,0.74,l,2.2079,2026-07-06,Garrafeira Nacional
BR Planalto,0.7,l,2.3184,2026-07-06,Garrafeira Nacional
BR Ribeiro Santo Colheita,0.74,l,2.1512,2026-07-06,Garrafeira Nacional
BR Ribeiro Santo Encruzado,2.99,l,4.1325,2026-07-06,Garrafeira Nacional
BR Titular Colheita,1.44,l,2.7484,2026-07-06,Garrafeira Nacional
BR Titular Reserva,1.64,l,5.1442,2026-07-06,Garrafeira Nacional
BR Valle do Nídeo,1.85,l,2.2209,2026-07-06,Garrafeira Nacional
BR Vinha Grande,0.89,l,4.9595,2026-07-06,Garrafeira Nacional
BR Volupia,1.49,l,3.4324,2026-07-06,Garrafeira Nacional
Bacalhau desfiado,3.18,kg,27.6461,2026-07-06,Peixaria do Porto
Batata,20.25,kg,1.1227,2026-07-06,Hortofrutícola Vale Verde
Batata a murro,1.46,kg,1.1139,2026-07-06,Hortofrutícola Vale Verde
Batata cozida,7.06,kg,1.0881,2026-07-06,Hortofrutícola Vale Verde
Batata frita,3.56,kg,1.1695,2026-07-06,Hortofrutícola Vale Verde
Batata palha,2.0,kg,1.2866,2026-07-06,Hortofrutícola Vale Verde
Bife de atum,1.55,kg,21.4982,2026-07-06,Peixaria do Porto
Bife de vaca,0.6,kg,16.9378,2026-07-06,Talho Central
Buldog,0.04,l,52.0533,2026-07-06,Bebidas & Companhia
Café moído,0.88,kg,21.372,2026-07-06,Mercearia Atlântico
Camarão,0.8,kg,19.9197,2026-07-06,Peixaria do Porto
Canela,0.04,kg,17.9494,2026-07-06,Mercearia Atlântico
Carne de vaca,0.51,kg,13.8141,2026-07-06,Talho Central
Cebola,0.81,kg,0.982,2026-07-06,Hortofrutícola Vale Verde
Cenoura,0.28,kg,1.1174,2026-07-06,Hortofrutícola Vale Verde
Chouriço,0.38,kg,10.5827,2026-07-06,Talho Central
Coca-Cola,4.83,l,2.1961,2026-07-06,Distribuidora Refrescos Lda
Coentros,0.13,kg,9.3492,2026-07-06,Hortofrutícola Vale Verde
Compal Néctar,0.34,l,3.5015,2026-07-06,Distribuidora Refrescos Lda
Conquilhas,0.33,kg,12.471,2026-07-06,Peixaria do Porto
Coxa de pato,0.29,kg,11.564,2026-07-06,Talho Central
Entrecosto de porco,1.75,kg,8.7029,2026-07-06,Talho Central
Entrecôte,2.91,kg,18.9966,2026-07-06,Talho Central
Filetes de peixe galo,25.19,kg,19.7872,2026-07-06,Peixaria do Porto
Filetes de polvo,5.83,kg,14.9294,2026-07-06,Peixaria do Porto
Fruta da época,0.35,kg,2.1529,2026-07-06,Hortofrutícola Vale Verde
Ingredientes variados,2.77,kg,4.7503,2026-07-06,Mercearia Atlântico
Legumes,0.9,kg,1.8442,2026-07-06,Hortofrutícola Vale Verde
Legumes salteados,0.85,kg,1.8769,2026-07-06,Hortofrutícola Vale Verde
Legumes variados,1.51,kg,1.8562,2026-07-06,Hortofrutícola Vale Verde
Limão,0.15,kg,2.3412,2026-07-06,Hortofrutícola Vale Verde
Lombo de bacalhau,1.6,kg,33.3317,2026-07-06,Peixaria do Porto
Lombo de vaca,0.72,kg,19.7466,2026-07-06,Talho Central
Malagueta,0.01,kg,6.9594,2026-07-06,Hortofrutícola Vale Verde
Manteiga,1.38,kg,7.0026,2026-07-06,Lacticínios Serra
Maçã,2.09,kg,1.7808,2026-07-06,Hortofrutícola Vale Verde
Melão,0.25,kg,1.5341,2026-07-06,Hortofrutícola Vale Verde
Mini Sagres,4.74,l,2.9129,2026-07-06,Distribuidora Refrescos Lda
Molho,0.34,l,5.995,2026-07-06,Mercearia Atlântico
Molho de frutos vermelhos,0.03,l,5.7193,2026-07-06,Mercearia Atlântico
Mostarda,0.06,kg,3.6004,2026-07-06,Mercearia Atlântico
Ovos,59.0,unit,0.234,2026-07-06,Lacticínios Serra
Peito de pato,0.28,kg,13.6219,2026-07-06,Talho Central
Peixe inteiro,1.79,kg,14.2466,2026-07-06,Peixaria do Porto
Peixe variado,1.29,kg,12.3814,2026-07-06,Peixaria do Porto
Pera,1.13,kg,2.1486,2026-07-06,Hortofrutícola Vale Verde
Picanha,0.72,kg,18.6673,2026-07-06,Talho Central
Polvo,2.21,kg,14.9226,2026-07-06,Peixaria do Porto
Posta de vaca,3.84,kg,18.8836,2026-07-06,Talho Central
Presunto,0.28,kg,21.6069,2026-07-06,Talho Central
"Pudim (leite, ovos, açúcar)",0.59,kg,4.8906,2026-07-06,Mercearia Atlântico
Pão,7.27,kg,3.4581,2026-07-06,Padaria Forno Antigo
RS Papa Figos,1.58,l,3.3451,2026-07-06,Garrafeira Nacional
Rabo de boi,1.15,kg,10.9777,2026-07-06,Talho Central
Rabo de boi desfiado,1.11,kg,11.132,2026-07-06,Talho Central
Sangria 1.5L,1.83,l,5.1746,2026-07-06,Distribuidora Refrescos Lda
Seven Up,0.62,l,2.1321,2026-07-06,Distribuidora Refrescos Lda
TT Burmester meia gr.,0.46,l,2.6131,2026-07-06,Garrafeira Nacional
TT Monte Peceguinha,2.28,l,5.7871,2026-07-06,Garrafeira Nacional
TT V.Nídeo Reserva,0.89,l,2.5623,2026-07-06,Garrafeira Nacional
Tamboril,0.45,kg,16.3463,2026-07-06,Peixaria do Porto
Tomate,1.08,kg,1.8687,2026-07-06,Hortofrutícola Vale Verde
V Muralhas,2.69,l,1.9382,2026-07-06,Garrafeira Nacional
V Regueiro,1.73,l,3.8192,2026-07-06,Garrafeira Nacional
Vinagre,0.01,l,1.7798,2026-07-06,Mercearia Atlântico
Vinho 0.5L,8.69,l,2.7589,2026-07-06,Distribuidora Refrescos Lda
Vinho 1L,5.03,l,0.7852,2026-07-06,Distribuidora Refrescos Lda
Vinho Branco da casa (copo),1.26,l,7.7228,2026-07-06,Distribuidora Refrescos Lda
Vinho Menu,2.7,l,2.52,2026-07-06,Distribuidora Refrescos Lda
Vinho Tinto da casa (copo),2.28,l,7.8842,2026-07-06,Distribuidora Refrescos Lda
Vinho branco,0.36,l,3.0514,2026-07-06,Mercearia Atlântico
Vinho tinto,1.02,l,3.1479,2026-07-06,Mercearia Atlântico
Água 0.33L,1.21,l,1.4487,2026-07-06,Distribuidora Refrescos Lda
Água 0.5L,31.22,l,1.1615,2026-07-06,Distribuidora Refrescos Lda
Água c/gás,2.16,l,2.4424,2026-07-06,Distribuidora Refrescos Lda
Aguardente,0.08,l,10.027,2026-07-13,Mercearia Atlântico
Alface,0.68,kg,1.5026,2026-07-13,Hortofrutícola Vale Verde
Alho,0.82,kg,4.9271,2026-07-13,Hortofrutícola Vale Verde
Ameijoas,8.54,kg,13.545,2026-07-13,Peixaria do Porto
Arroz,3.41,kg,1.4871,2026-07-13,Mercearia Atlântico
Azeite,4.39,l,6.1697,2026-07-13,Mercearia Atlântico
Azeitonas,2.64,kg,4.812,2026-07-13,Mercearia Atlântico
Açúcar,0.96,kg,1.154,2026-07-13,Mercearia Atlântico
BR Duvalley Reserva,0.9,l,4.4766,2026-07-13,Garrafeira Nacional
BR Luis Pato Maria Gomes,2.34,l,2.6788,2026-07-13,Garrafeira Nacional
BR Luis Pato Vinhas Velhas,0.79,l,4.1465,2026-07-13,Garrafeira Nacional
BR Monte Peceguinha,2.69,l,5.3599,2026-07-13,Garrafeira Nacional
BR Papa Figos,0.81,l,3.4488,2026-07-13,Garrafeira Nacional
BR Piano Moscatel Galego,0.74,l,2.2985,2026-07-13,Garrafeira Nacional
BR Planalto,2.1,l,2.2194,2026-07-13,Garrafeira Nacional
BR Qta Portal Moscatel,1.92,l,4.2258,2026-07-13,Garrafeira Nacional
BR Ribeiro Santo Colheita,0.74,l,2.1316,2026-07-13,Garrafeira Nacional
BR Ribeiro Santo Encruzado,3.73,l,4.2035,2026-07-13,Garrafeira Nacional
BR V. Nídeo SauvignonBlanc,0.74,l,3.1716,2026-07-13,Garrafeira Nacional
BR Valle do Nídeo,0.93,l,2.2419,2026-07-13,Garrafeira Nacional
BR Vinha Grande,1.78,l,4.7971,2026-07-13,Garrafeira Nacional
Bacalhau desfiado,5.72,kg,27.376,2026-07-13,Peixaria do Porto
Bacon,0.04,kg,9.5532,2026-07-13,Talho Central
Batata,17.36,kg,1.0313,2026-07-13,Hortofrutícola Vale Verde
Batata a murro,1.66,kg,1.1002,2026-07-13,Hortofrutícola Vale Verde
Batata cozida,4.89,kg,1.1123,2026-07-13,Hortofrutícola Vale Verde
Batata frita,4.47,kg,1.1779,2026-07-13,Hortofrutícola Vale Verde
Batata palha,3.85,kg,1.3462,2026-07-13,Hortofrutícola Vale Verde
Bife de atum,1.55,kg,21.8071,2026-07-13,Peixaria do Porto
Bife de vaca,0.3,kg,17.325,2026-07-13,Talho Central
Café moído,1.04,kg,21.93,2026-07-13,Mercearia Atlântico
Camarão,0.69,kg,18.7387,2026-07-13,Peixaria do Porto
Camarão da costa,1.19,kg,31.2573,2026-07-13,Peixaria do Porto
Canela,0.07,kg,17.286,2026-07-13,Mercearia Atlântico
Carne de vaca,1.28,kg,14.5984,2026-07-13,Talho Central
Cebola,1.36,kg,0.9815,2026-07-13,Hortofrutícola Vale Verde
Cenoura,0.24,kg,1.0503,2026-07-13,Hortofrutícola Vale Verde
Chouriço,0.94,kg,10.3383,2026-07-13,Talho Central
Coca-Cola,5.74,l,2.1699,2026-07-13,Distribuidora Refrescos Lda
Coentros,0.17,kg,9.4661,2026-07-13,Hortofrutícola Vale Verde
Coxa de pato,0.58,kg,11.7945,2026-07-13,Talho Central
E Quinta Ortigão,0.76,l,3.9477,2026-07-13,Garrafeira Nacional
E S.Domingos,1.59,l,3.5886,2026-07-13,Garrafeira Nacional
ES S. Domingos Extra Reserva,0.81,l,3.6889,2026-07-13,Garrafeira Nacional
Entrecosto de porco,3.11,kg,8.0644,2026-07-13,Talho Central
Entrecôte,1.45,kg,19.6436,2026-07-13,Talho Central
Feijão preto cozido,0.23,kg,2.9311,2026-07-13,Hortofrutícola Vale Verde
Filetes de peixe galo,20.49,kg,19.9439,2026-07-13,Peixaria do Porto
Filetes de polvo,4.97,kg,15.9964,2026-07-13,Peixaria do Porto
Frango,0.09,kg,5.2499,2026-07-13,Talho Central
Fruta da época,0.35,kg,2.1323,2026-07-13,Hortofrutícola Vale Verde
Gelado,0.46,kg,6.0352,2026-07-13,Mercearia Atlântico
Ingredientes variados,2.77,kg,5.0357,2026-07-13,Mercearia Atlântico
Legumes,1.35,kg,1.8432,2026-07-13,Hortofrutícola Vale Verde
Legumes salteados,0.85,kg,1.7314,2026-07-13,Hortofrutícola Vale Verde
Legumes variados,0.51,kg,1.8762,2026-07-13,Hortofrutícola Vale Verde
Leite,1.74,l,1.0993,2026-07-13,Lacticínios Serra
Limão,0.16,kg,2.3248,2026-07-13,Hortofrutícola Vale Verde
Lombo de bacalhau,0.4,kg,33.925,2026-07-13,Peixaria do Porto
Lombo de vaca,0.54,kg,18.3577,2026-07-13,Talho Central
Maionese,0.02,kg,3.5866,2026-07-13,Mercearia Atlântico
Malagueta,0.01,kg,7.0162,2026-07-13,Hortofrutícola Vale Verde
Manteiga,1.34,kg,7.4456,2026-07-13,Lacticínios Serra
Martini Bianco,0.04,l,18.1581,2026-07-13,Bebidas & Companhia
Maçã,2.09,kg,1.8672,2026-07-13,Hortofrutícola Vale Verde
Melão,1.26,kg,1.5373,2026-07-13,Hortofrutícola Vale Verde
Mini Sagres,4.74,l,2.884,2026-07-13,Distribuidora Refrescos Lda
Molho,0.17,l,5.8103,2026-07-13,Mercearia Atlântico
Molho de frutos vermelhos,0.1,l,5.727,2026-07-13,Mercearia Atlântico
Moscatel Roxo,0.13,l,22.8679,2026-07-13,Bebidas & Companhia
Mostarda,0.08,kg,3.5465,2026-07-13,Mercearia Atlântico
Ovos,94.0,unit,0.2442,2026-07-13,Lacticínios Serra
Peito de pato,0.85,kg,12.7588,2026-07-13,Talho Central
Peixe inteiro,1.79,kg,13.913,2026-07-13,Peixaria do Porto
Peixe variado,1.93,kg,11.4902,2026-07-13,Peixaria do Porto
Pera,2.26,kg,2.0812,2026-07-13,Hortofrutícola Vale Verde
Picanha,2.9,kg,17.4899,2026-07-13,Talho Central
Polvo,4.02,kg,14.6763,2026-07-13,Peixaria do Porto
Polvo cozido,0.92,kg,14.3499,2026-07-13,Peixaria do Porto
Presunto,0.79,kg,21.921,2026-07-13,Talho Central
"Pudim (leite, ovos, açúcar)",1.46,kg,4.8188,2026-07-13,Mercearia Atlântico
Pão,6.98,kg,3.6631,2026-07-13,Padaria Forno Antigo
Pão de forma,0.11,kg,4.2993,2026-07-13,Padaria Forno Antigo
RS Papa Figos,0.79,l,3.2647,2026-07-13,Garrafeira Nacional
Rabo de boi,0.98,kg,10.7968,2026-07-13,Talho Central
Rabo de boi desfiado,1.2,kg,11.3275,2026-07-13,Talho Central
Salsa,0.01,kg,9.3312,2026-07-13,Hortofrutícola Vale Verde
Sangria 1.5L,7.32,l,5.4044,2026-07-13,Distribuidora Refrescos Lda
Seven Up,0.62,l,2.253,2026-07-13,Distribuidora Refrescos Lda
TT Dona Matilde,1.78,l,3.6421,2026-07-13,Garrafeira Nacional
TT Esteva,0.88,l,2.1322,2026-07-13,Garrafeira Nacional
TT Galhardini,0.71,l,3.2222,2026-07-13,Garrafeira Nacional
TT Papa Figos,0.82,l,3.1485,2026-07-13,Garrafeira Nacional
TT V.Nídeo Reserva,0.89,l,2.6277,2026-07-13,Garrafeira Nacional
Tomate,1.65,kg,1.7794,2026-07-13,Hortofrutícola Vale Verde
Vinagre,0.08,l,1.8605,2026-07-13,Mercearia Atlântico
Vinho 0.5L,7.82,l,2.7712,2026-07-13,Distribuidora Refrescos Lda
Vinho 1L,3.78,l,0.7644,2026-07-13,Distribuidora Refrescos Lda
Vinho Branco da casa (copo),1.76,l,8.1014,2026-07-13,Distribuidora Refrescos Lda
Vinho Menu,2.7,l,2.4909,2026-07-13,Distribuidora Refrescos Lda
Vinho Tinto da casa (copo),1.05,l,8.1436,2026-07-13,Distribuidora Refrescos Lda
Vinho branco,0.46,l,2.9119,2026-07-13,Mercearia Atlântico
Vinho tinto,1.74,l,3.1012,2026-07-13,Mercearia Atlântico
Água 0.5L,43.31,l,1.1831,2026-07-13,Distribuidora Refrescos Lda
Água c/gás,4.86,l,2.6204,2026-07-13,Distribuidora Refrescos Lda
Aguardente,0.05,l,9.3548,2026-07-20,Mercearia Atlântico
Alface,0.47,kg,1.5101,2026-07-20,Hortofrutícola Vale Verde
Alheira,0.24,kg,10.0672,2026-07-20,Talho Central
Alho,0.86,kg,4.8273,2026-07-20,Hortofrutícola Vale Verde
Ameijoas,8.31,kg,13.6035,2026-07-20,Peixaria do Porto
Amendoa Amarga,0.09,l,17.5005,2026-07-20,Bebidas & Companhia
Arroz,4.91,kg,1.5413,2026-07-20,Mercearia Atlântico
Azeite,4.56,l,5.8925,2026-07-20,Mercearia Atlântico
Azeitonas,1.55,kg,4.7591,2026-07-20,Mercearia Atlântico
Açúcar,0.39,kg,1.153,2026-07-20,Mercearia Atlântico
BR Burmester meia gr.,0.45,l,2.552,2026-07-20,Garrafeira Nacional
BR Duvalley,0.93,l,3.0615,2026-07-20,Garrafeira Nacional
BR Duvalley Reserva,0.9,l,4.5684,2026-07-20,Garrafeira Nacional
BR Monte Peceguinha,2.02,l,5.5708,2026-07-20,Garrafeira Nacional
BR Papa Figos,2.43,l,3.3208,2026-07-20,Garrafeira Nacional
BR Ribeiro Santo Encruzado,5.97,l,4.1316,2026-07-20,Garrafeira Nacional
BR Valle do Nídeo,2.78,l,2.2102,2026-07-20,Garrafeira Nacional
BR Vinha Grande,1.78,l,4.8803,2026-07-20,Garrafeira Nacional
BR Volupia,0.75,l,3.5064,2026-07-20,Garrafeira Nacional
Bacalhau desfiado,1.91,kg,26.4667,2026-07-20,Peixaria do Porto
Batata,13.91,kg,1.1265,2026-07-20,Hortofrutícola Vale Verde
Batata a murro,3.53,kg,1.0703,2026-07-20,Hortofrutícola Vale Verde
Batata cozida,4.98,kg,1.05,2026-07-20,Hortofrutícola Vale Verde
Batata frita,3.69,kg,1.2146,2026-07-20,Hortofrutícola Vale Verde
Batata palha,2.0,kg,1.2959,2026-07-20,Hortofrutícola Vale Verde
Bife de atum,0.39,kg,20.8422,2026-07-20,Peixaria do Porto
Bife de vaca,0.6,kg,17.6085,2026-07-20,Talho Central
Bolo de chocolate,0.97,kg,7.1685,2026-07-20,Mercearia Atlântico
Café moído,1.08,kg,21.5087,2026-07-20,Mercearia Atlântico
Camarão,1.25,kg,19.6758,2026-07-20,Peixaria do Porto
Camarão da costa,0.75,kg,29.2486,2026-07-20,Peixaria do Porto
Canela,0.03,kg,17.3283,2026-07-20,Mercearia Atlântico
Carne de vaca,0.51,kg,14.9499,2026-07-20,Talho Central
Cebola,1.19,kg,0.9902,2026-07-20,Hortofrutícola Vale Verde
Cenoura,0.28,kg,1.1275,2026-07-20,Hortofrutícola Vale Verde
Chocolate,0.17,kg,9.2688,2026-07-20,Mercearia Atlântico
Chouriço,0.57,kg,10.3528,2026-07-20,Talho Central
Coca-Cola,4.83,l,2.1603,2026-07-20,Distribuidora Refrescos Lda
Coentros,0.17,kg,9.3836,2026-07-20,Hortofrutícola Vale Verde
Compal Néctar,0.34,l,3.6625,2026-07-20,Distribuidora Refrescos Lda
Coxa de pato,0.58,kg,11.9019,2026-07-20,Talho Central
E S.Domingos,0.79,l,3.827,2026-07-20,Garrafeira Nacional
ES Quinta Monteirinhos,0.95,l,5.2266,2026-07-20,Garrafeira Nacional
Entrecosto de porco,2.14,kg,8.0795,2026-07-20,Talho Central
Entrecôte,2.42,kg,18.4196,2026-07-20,Talho Central
Filetes de peixe galo,16.6,kg,18.8718,2026-07-20,Peixaria do Porto
Filetes de polvo,4.43,kg,15.6755,2026-07-20,Peixaria do Porto
Fruta da época,0.88,kg,2.0572,2026-07-20,Hortofrutícola Vale Verde
Gelado,0.23,kg,5.9304,2026-07-20,Mercearia Atlântico
Ingredientes variados,2.43,kg,4.6377,2026-07-20,Mercearia Atlântico
Legumes,2.15,kg,1.8222,2026-07-20,Hortofrutícola Vale Verde
Legumes salteados,0.21,kg,1.806,2026-07-20,Hortofrutícola Vale Verde
Legumes variados,2.05,kg,1.8854,2026-07-20,Hortofrutícola Vale Verde
Limão,0.22,kg,2.5015,2026-07-20,Hortofrutícola Vale Verde
Lombo de bacalhau,2.4,kg,32.3362,2026-07-20,Peixaria do Porto
Lombo de vaca,0.72,kg,18.3095,2026-07-20,Talho Central
Malagueta,0.01,kg,6.8546,2026-07-20,Hortofrutícola Vale Verde
Manteiga,0.83,kg,6.8407,2026-07-20,Lacticínios Serra
Marisco variado,1.26,kg,16.5735,2026-07-20,Peixaria do Porto
Martini,0.14,l,18.8989,2026-07-20,Bebidas & Companhia
Maçã,1.22,kg,1.7113,2026-07-20,Hortofrutícola Vale Verde
Molho,0.28,l,6.0298,2026-07-20,Mercearia Atlântico
Molho de frutos vermelhos,0.07,l,6.1253,2026-07-20,Mercearia Atlântico
Mostarda,0.06,kg,3.6424,2026-07-20,Mercearia Atlântico
Ovo,5.0,unit,0.2415,2026-07-20,Lacticínios Serra
Ovos,49.0,unit,0.2305,2026-07-20,Lacticínios Serra
Peito de pato,0.57,kg,12.5855,2026-07-20,Talho Central
Peixe inteiro,3.14,kg,14.0315,2026-07-20,Peixaria do Porto
Peixe variado,3.06,kg,11.6448,2026-07-20,Peixaria do Porto
Pera,1.51,kg,2.2553,2026-07-20,Hortofrutícola Vale Verde
Picanha,1.09,kg,17.3638,2026-07-20,Talho Central
Polvo,7.14,kg,14.2221,2026-07-20,Peixaria do Porto
Polvo cozido,0.69,kg,13.9119,2026-07-20,Peixaria do Porto
Presunto,0.54,kg,20.5442,2026-07-20,Talho Central
"Pudim (leite, ovos, açúcar)",1.07,kg,4.8529,2026-07-20,Mercearia Atlântico
Pão,4.7,kg,3.6105,2026-07-20,Padaria Forno Antigo
RS Titular Rosé,0.95,l,2.534,2026-07-20,Garrafeira Nacional
Rabo de boi,1.15,kg,11.0787,2026-07-20,Talho Central
Rabo de boi desfiado,0.94,kg,11.2657,2026-07-20,Talho Central
Salsa,0.01,kg,9.7672,2026-07-20,Hortofrutícola Vale Verde
Sangria 1.5L,1.83,l,5.6023,2026-07-20,Distribuidora Refrescos Lda
Sangria 1L,1.01,l,6.0236,2026-07-20,Distribuidora Refrescos Lda
Seven Up,0.92,l,2.0858,2026-07-20,Distribuidora Refrescos Lda
TT Burmester meia gr.,0.46,l,2.6417,2026-07-20,Garrafeira Nacional
TT Dona Matilde Res,1.82,l,9.2672,2026-07-20,Garrafeira Nacional
TT Monte Peceguinha,0.76,l,5.5786,2026-07-20,Garrafeira Nacional
TT V.Nídeo Reserva,3.58,l,2.5387,2026-07-20,Garrafeira Nacional
Tamboril,1.81,kg,16.6852,2026-07-20,Peixaria do Porto
Tomate,3.22,kg,1.7876,2026-07-20,Hortofrutícola Vale Verde
V Muralhas,1.8,l,1.8573,2026-07-20,Garrafeira Nacional
Vinagre,0.06,l,1.7259,2026-07-20,Mercearia Atlântico
Vinho 0.5L,3.48,l,2.5844,2026-07-20,Distribuidora Refrescos Lda
Vinho 1L,8.81,l,0.7961,2026-07-20,Distribuidora Refrescos Lda
Vinho Branco da casa (copo),1.26,l,8.0718,2026-07-20,Distribuidora Refrescos Lda
Vinho Menu,3.44,l,2.4974,2026-07-20,Distribuidora Refrescos Lda
Vinho Tinto da casa (copo),1.23,l,8.1472,2026-07-20,Distribuidora Refrescos Lda
Vinho branco,0.46,l,2.8673,2026-07-20,Mercearia Atlântico
Vinho tinto,1.27,l,3.0483,2026-07-20,Mercearia Atlântico
Água 0.33L,0.4,l,1.4674,2026-07-20,Distribuidora Refrescos Lda
Água 0.5L,37.77,l,1.1691,2026-07-20,Distribuidora Refrescos Lda
Água c/gás,5.13,l,2.6128,2026-07-20,Distribuidora Refrescos Lda
Aguardente,0.05,l,9.9601,2026-07-27,Mercearia Atlântico
Alface,0.31,kg,1.3794,2026-07-27,Hortofrutícola Vale Verde
Alho,0.96,kg,4.9328,2026-07-27,Hortofrutícola Vale Verde
Ameijoas,4.27,kg,13.515,2026-07-27,Peixaria do Porto
Arroz,3.6,kg,1.5065,2026-07-27,Mercearia Atlântico
Azeite,5.64,l,6.248,2026-07-27,Mercearia Atlântico
Azeitonas,2.02,kg,4.7852,2026-07-27,Mercearia Atlântico
Açúcar,0.94,kg,1.1698,2026-07-27,Mercearia Atlântico
BR Papa Figos,1.62,l,3.2969,2026-07-27,Garrafeira Nacional
BR Piano Moscatel Galego,0.74,l,2.244,2026-07-27,Garrafeira Nacional
BR Planalto,0.7,l,2.2606,2026-07-27,Garrafeira Nacional
BR Qta Portal Moscatel,2.88,l,3.8324,2026-07-27,Garrafeira Nacional
BR Ribeiro Santo Encruzado,8.96,l,3.9036,2026-07-27,Garrafeira Nacional
BR Valle do Nídeo,4.64,l,2.1205,2026-07-27,Garrafeira Nacional
BR Vinha Grande,1.78,l,4.834,2026-07-27,Garrafeira Nacional
Bacalhau desfiado,2.86,kg,25.8283,2026-07-27,Peixaria do Porto
Bacon,0.04,kg,9.2263,2026-07-27,Talho Central
Batata,21.09,kg,1.0919,2026-07-27,Hortofrutícola Vale Verde
Batata a murro,2.91,kg,1.0398,2026-07-27,Hortofrutícola Vale Verde
Batata cozida,10.23,kg,1.0521,2026-07-27,Hortofrutícola Vale Verde
Batata frita,5.27,kg,1.2007,2026-07-27,Hortofrutícola Vale Verde
Batata palha,2.77,kg,1.3297,2026-07-27,Hortofrutícola Vale Verde
Beirão,0.04,l,23.164,2026-07-27,Bebidas & Companhia
Bife de atum,1.55,kg,22.2902,2026-07-27,Peixaria do Porto
Bife de vaca,0.45,kg,17.6154,2026-07-27,Talho Central
Bolo de chocolate,0.39,kg,7.2976,2026-07-27,Mercearia Atlântico
CRF-Reserva,0.05,l,29.3008,2026-07-27,Bebidas & Companhia
Café moído,1.25,kg,22.0536,2026-07-27,Mercearia Atlântico
Camarão,0.89,kg,18.7337,2026-07-27,Peixaria do Porto
Camarão da costa,0.3,kg,30.3073,2026-07-27,Peixaria do Porto
Canela,0.07,kg,18.7452,2026-07-27,Mercearia Atlântico
Carne de vaca,0.26,kg,14.0456,2026-07-27,Talho Central
Cebola,1.11,kg,0.9217,2026-07-27,Hortofrutícola Vale Verde
Cenoura,0.08,kg,1.0599,2026-07-27,Hortofrutícola Vale Verde
Chocolate,0.07,kg,9.4845,2026-07-27,Mercearia Atlântico
Chouriço,0.57,kg,11.0334,2026-07-27,Talho Central
Coca-Cola,9.36,l,2.2066,2026-07-27,Distribuidora Refrescos Lda
Coentros,0.08,kg,9.262,2026-07-27,Hortofrutícola Vale Verde
Compal Néctar,0.34,l,3.6534,2026-07-27,Distribuidora Refrescos Lda
Coxa de pato,0.58,kg,12.5024,2026-07-27,Talho Central
E Quinta Ortigão,0.76,l,4.0571,2026-07-27,Garrafeira Nacional
ES Ortigão Nektar,0.69,l,2.5279,2026-07-27,Garrafeira Nacional
ES S. Domingos Extra Reserva,0.81,l,3.6761,2026-07-27,Garrafeira Nacional
Entrecosto de porco,1.36,kg,8.2975,2026-07-27,Talho Central
Entrecôte,5.58,kg,18.3566,2026-07-27,Talho Central
Filetes de peixe galo,25.42,kg,18.5478,2026-07-27,Peixaria do Porto
Filetes de polvo,10.04,kg,16.0537,2026-07-27,Peixaria do Porto
Frango,0.09,kg,5.4486,2026-07-27,Talho Central
Fruta da época,0.53,kg,2.2172,2026-07-27,Hortofrutícola Vale Verde
Gelado,0.34,kg,5.8619,2026-07-27,Mercearia Atlântico
Gin Paragon,0.09,l,14.0766,2026-07-27,Bebidas & Companhia
Ingredientes variados,4.87,kg,4.851,2026-07-27,Mercearia Atlântico
Jameson,0.04,l,29.246,2026-07-27,Bebidas & Companhia
Legumes,2.71,kg,1.8701,2026-07-27,Hortofrutícola Vale Verde
Legumes salteados,0.85,kg,1.8277,2026-07-27,Hortofrutícola Vale Verde
Legumes variados,1.28,kg,1.8212,2026-07-27,Hortofrutícola Vale Verde
Leite,1.96,l,1.0273,2026-07-27,Lacticínios Serra
Limão,0.16,kg,2.3607,2026-07-27,Hortofrutícola Vale Verde
Lombo de bacalhau,3.6,kg,34.1067,2026-07-27,Peixaria do Porto
Lombo de vaca,0.9,kg,20.0267,2026-07-27,Talho Central
Maionese,0.02,kg,3.6903,2026-07-27,Mercearia Atlântico
Malagueta,0.01,kg,7.459,2026-07-27,Hortofrutícola Vale Verde
Manteiga,1.08,kg,6.9116,2026-07-27,Lacticínios Serra
Marisco,0.49,kg,16.7344,2026-07-27,Peixaria do Porto
Maçã,2.09,kg,1.8088,2026-07-27,Hortofrutícola Vale Verde
Melão,1.51,kg,1.5698,2026-07-27,Hortofrutícola Vale Verde
Mini Sagres,1.25,l,2.7546,2026-07-27,Distribuidora Refrescos Lda
Molho,0.65,l,6.0293,2026-07-27,Mercearia Atlântico
Molho de frutos vermelhos,0.03,l,5.8857,2026-07-27,Mercearia Atlântico
Mostarda,0.04,kg,3.5028,2026-07-27,Mercearia Atlântico
Ovos,66.0,unit,0.2324,2026-07-27,Lacticínios Serra
Peito de pato,0.28,kg,13.6249,2026-07-27,Talho Central
Peixe inteiro,4.03,kg,13.7755,2026-07-27,Peixaria do Porto
Peixe variado,4.99,kg,11.7515,2026-07-27,Peixaria do Porto
Pera,1.89,kg,2.1935,2026-07-27,Hortofrutícola Vale Verde
Picanha,1.27,kg,18.8626,2026-07-27,Talho Central
Pimento,0.17,kg,2.4342,2026-07-27,Hortofrutícola Vale Verde
Polvo,3.5,kg,14.8281,2026-07-27,Peixaria do Porto
Polvo cozido,1.61,kg,13.8212,2026-07-27,Peixaria do Porto
Posta de vaca,0.48,kg,17.5407,2026-07-27,Talho Central
Presunto,1.0,kg,21.5414,2026-07-27,Talho Central
"Pudim (leite, ovos, açúcar)",0.78,kg,4.9179,2026-07-27,Mercearia Atlântico
Pão,6.41,kg,3.5202,2026-07-27,Padaria Forno Antigo
Pão de forma,0.11,kg,4.3153,2026-07-27,Padaria Forno Antigo
RS Papa Figos,1.58,l,3.3368,2026-07-27,Garrafeira Nacional
RS Titular Rosé,9.49,l,2.5119,2026-07-27,Garrafeira Nacional
Rabo de boi,0.33,kg,10.8764,2026-07-27,Talho Central
Rabo de boi desfiado,1.97,kg,11.0257,2026-07-27,Talho Central
Salsa,0.02,kg,9.6903,2026-07-27,Hortofrutícola Vale Verde
Sangria 1.5L,9.15,l,5.5757,2026-07-27,Distribuidora Refrescos Lda
Seven Up,1.23,l,2.2268,2026-07-27,Distribuidora Refrescos Lda
TT Esteva,0.88,l,2.2626,2026-07-27,Garrafeira Nacional
TT Papa Figos,0.82,l,3.2046,2026-07-27,Garrafeira Nacional
TT QUINTA VENTOZELO,0.68,l,5.7443,2026-07-27,Garrafeira Nacional
Tamboril,2.04,kg,16.9549,2026-07-27,Peixaria do Porto
Tomate,3.19,kg,1.8846,2026-07-27,Hortofrutícola Vale Verde
V Muralhas,2.69,l,1.9887,2026-07-27,Garrafeira Nacional
V Regueiro,3.46,l,4.0547,2026-07-27,Garrafeira Nacional
Vinagre,0.09,l,1.8593,2026-07-27,Mercearia Atlântico
Vinho 0.5L,3.48,l,2.569,2026-07-27,Distribuidora Refrescos Lda
Vinho 1L,5.03,l,0.7452,2026-07-27,Distribuidora Refrescos Lda
Vinho Branco da casa (copo),0.76,l,7.7877,2026-07-27,Distribuidora Refrescos Lda
Vinho Menu,2.99,l,2.501,2026-07-27,Distribuidora Refrescos Lda
Vinho Tinto da casa (copo),0.53,l,7.678,2026-07-27,Distribuidora Refrescos Lda
Vinho branco,0.34,l,3.0054,2026-07-27,Mercearia Atlântico
Vinho tinto,1.33,l,2.913,2026-07-27,Mercearia Atlântico
Água 0.5L,37.77,l,1.1799,2026-07-27,Distribuidora Refrescos Lda
Água c/gás,5.4,l,2.4896,2026-07-27,Distribuidora Refrescos Lda
Alface,0.09,kg,1.4776,2026-08-03,Hortofrutícola Vale Verde
Alho,0.27,kg,4.7721,2026-08-03,Hortofrutícola Vale Verde
Ameijoas,2.02,kg,14.1369,2026-08-03,Peixaria do Porto
Arroz,2.6,kg,1.5104,2026-08-03,Mercearia Atlântico
Azeite,1.87,l,6.2297,2026-08-03,Mercearia Atlântico
Azeitonas,0.53,kg,4.722,2026-08-03,Mercearia Atlântico
Açúcar,0.1,kg,1.1868,2026-08-03,Mercearia Atlântico
BR Luis Pato Vinhas Velhas,0.79,l,4.477,2026-08-03,Garrafeira Nacional
BR Volupia,0.75,l,3.5299,2026-08-03,Garrafeira Nacional
Bacalhau desfiado,0.64,kg,26.9902,2026-08-03,Peixaria do Porto
Batata,6.7,kg,1.1178,2026-08-03,Hortofrutícola Vale Verde
Batata a murro,1.04,kg,1.0918,2026-08-03,Hortofrutícola Vale Verde
Batata cozida,2.62,kg,1.1205,2026-08-03,Hortofrutícola Vale Verde
Batata frita,0.65,kg,1.1666,2026-08-03,Hortofrutícola Vale Verde
Batata palha,0.92,kg,1.3687,2026-08-03,Hortofrutícola Vale Verde
Beirão,0.04,l,23.1892,2026-08-03,Bebidas & Companhia
Bife de atum,0.58,kg,20.766,2026-08-03,Peixaria do Porto
Bife de vaca,0.15,kg,17.5614,2026-08-03,Talho Central
Café moído,0.47,kg,22.2068,2026-08-03,Mercearia Atlântico
Camarão,0.71,kg,20.0909,2026-08-03,Peixaria do Porto
Camarão da costa,0.3,kg,29.4971,2026-08-03,Peixaria do Porto
Canela,0.01,kg,17.5638,2026-08-03,Mercearia Atlântico
Cebola,0.42,kg,0.9551,2026-08-03,Hortofrutícola Vale Verde
Cenoura,0.16,kg,1.0552,2026-08-03,Hortofrutícola Vale Verde
Coca-Cola,1.81,l,2.1417,2026-08-03,Distribuidora Refrescos Lda
Coentros,0.04,kg,9.3547,2026-08-03,Hortofrutícola Vale Verde
Compal Néctar,0.34,l,3.5393,2026-08-03,Distribuidora Refrescos Lda
ES S. Domingos Extra Reserva,0.81,l,3.6177,2026-08-03,Garrafeira Nacional
Entrecosto de porco,0.58,kg,8.6192,2026-08-03,Talho Central
Filetes de peixe galo,8.59,kg,19.9988,2026-08-03,Peixaria do Porto
Filetes de polvo,2.05,kg,15.1171,2026-08-03,Peixaria do Porto
Gelado,0.11,kg,6.025,2026-08-03,Mercearia Atlântico
Ingredientes variados,1.88,kg,4.8225,2026-08-03,Mercearia Atlântico
Legumes,0.68,kg,1.7436,2026-08-03,Hortofrutícola Vale Verde
Legumes salteados,0.32,kg,1.8287,2026-08-03,Hortofrutícola Vale Verde
Legumes variados,1.03,kg,1.7697,2026-08-03,Hortofrutícola Vale Verde
Limão,0.09,kg,2.387,2026-08-03,Hortofrutícola Vale Verde
Lombo de bacalhau,0.8,kg,33.9728,2026-08-03,Peixaria do Porto
Lombo de vaca,0.18,kg,18.7532,2026-08-03,Talho Central
Manteiga,0.29,kg,7.1666,2026-08-03,Lacticínios Serra
Melão,0.25,kg,1.6325,2026-08-03,Hortofrutícola Vale Verde
Mostarda,0.01,kg,3.4904,2026-08-03,Mercearia Atlântico
Ovos,24.0,unit,0.2498,2026-08-03,Lacticínios Serra
Peixe inteiro,2.24,kg,15.0035,2026-08-03,Peixaria do Porto
Peixe variado,0.97,kg,12.1757,2026-08-03,Peixaria do Porto
Pera,0.57,kg,2.0623,2026-08-03,Hortofrutícola Vale Verde
Picanha,0.36,kg,17.4059,2026-08-03,Talho Central
Polvo,2.47,kg,14.27,2026-08-03,Peixaria do Porto
Presunto,0.36,kg,21.5255,2026-08-03,Talho Central
"Pudim (leite, ovos, açúcar)",0.78,kg,5.0205,2026-08-03,Mercearia Atlântico
Pão,1.36,kg,3.4939,2026-08-03,Padaria Forno Antigo
Rabo de boi,0.66,kg,10.9872,2026-08-03,Talho Central
Seven Up,0.92,l,2.2202,2026-08-03,Distribuidora Refrescos Lda
TT Esteva,0.88,l,2.1115,2026-08-03,Garrafeira Nacional
Tamboril,1.81,kg,15.9873,2026-08-03,Peixaria do Porto
Tomate,1.4,kg,1.8417,2026-08-03,Hortofrutícola Vale Verde
V Muralhas,0.9,l,1.9815,2026-08-03,Garrafeira Nacional
Vinagre,0.01,l,1.8254,2026-08-03,Mercearia Atlântico
Vinho 0.5L,4.34,l,2.6253,2026-08-03,Distribuidora Refrescos Lda
Vinho 1L,1.26,l,0.7398,2026-08-03,Distribuidora Refrescos Lda
Vinho Branco da casa (copo),0.76,l,8.1689,2026-08-03,Distribuidora Refrescos Lda
Vinho Menu,2.55,l,2.5676,2026-08-03,Distribuidora Refrescos Lda
Vinho Tinto da casa (copo),0.53,l,7.961,2026-08-03,Distribuidora Refrescos Lda
Vinho branco,0.1,l,2.9622,2026-08-03,Mercearia Atlântico
Vinho tinto,0.53,l,2.8751,2026-08-03,Mercearia Atlântico
Água 0.5L,11.58,l,1.1673,2026-08-03,Distribuidora Refrescos Lda
Água c/gás,1.08,l,2.411,2026-08-03,Distribuidora Refrescos Lda`;

function parseCsvText(text) {
  return Papa.parse(text, { header: true, skipEmptyLines: true }).data;
}

function buildSampleDishes() {
  const rows = parseCsvText(MENU_CSV_RAW);
  const byKey = {};
  const list = [];
  rows.forEach((row) => {
    const name = (row.dish || "").trim();
    if (!name) return;
    const k = name.toLowerCase();
    let dish = byKey[k];
    if (!dish) {
      dish = { id: uid(), name, price: Number(row.price) || 0, category: (row.category || "").trim(), prepTime: row.prepTime ? Number(row.prepTime) : "", ingredients: [] };
      byKey[k] = dish;
      list.push(dish);
    }
    if (row.ingredient) {
      dish.ingredients.push({ id: uid(), name: (row.ingredient || "").trim(), qty: row.qty || row.quantity || "", unit: row.unit || "g" });
    }
  });
  return list;
}

function buildSampleRows(csvText, mapper) {
  return parseCsvText(csvText).filter((r) => Object.values(r).some((v) => v !== "")).map((row) => ({ id: uid(), ...mapper(row) }));
}

const SAMPLE_DISHES = buildSampleDishes();
const SAMPLE_PURCHASES = buildSampleRows(PURCHASES_CSV_RAW, (r) => ({ item: r.item, quantity: Number(r.quantity), unit: r.unit, unitPrice: Number(r.unitPrice), date: r.date, supplier: r.supplier }));
const SAMPLE_SALES = buildSampleRows(SALES_CSV_RAW, (r) => ({ dish: r.dish, quantity: Number(r.quantity), date: r.date }));

function computeAnalysis(dishes, purchases, sales, overhead = { kitchenLabor: 0, tableLabor: 0, otherLabor: 0, buildingCost: 0, energyCost: 0, waterCost: 0, otherCost: 0, method: "even" }) {
  // Menu ingredient keys — used to detect purchased items that don't match any recipe
  const menuIngredientKeys = new Set();
  dishes.forEach((d) => d.ingredients.forEach((ing) => { if (norm(ing.name)) menuIngredientKeys.add(norm(ing.name)); }));

  const purchasedBase = {}, purchasedCost = {}, purchasedDims = {}, purchasedEntries = {};
  purchases.forEach((p) => {
    const k = norm(p.item);
    if (!k) return;
    const { value, base, dim } = toBase(p.quantity, p.unit);
    purchasedBase[k] = (purchasedBase[k] || 0) + value;
    purchasedCost[k] = (purchasedCost[k] || 0) + Number(p.quantity || 0) * Number(p.unitPrice || 0);
    purchasedDims[k] = purchasedDims[k] || new Set();
    purchasedDims[k].add(dim);
    purchasedEntries[k] = (purchasedEntries[k] || 0) + 1;
    purchasedEntries[k + "__base"] = base;
  });

  const dishByName = {};
  dishes.forEach((d) => { dishByName[norm(d.name)] = d; });

  const expectedBase = {};
  const expectedDims = {};
  const soldCount = {};
  let totalRevenue = 0;
  let unmatchedSalesQty = 0;
  const unmatchedSalesByName = {};
  sales.forEach((s) => {
    const dish = dishByName[norm(s.dish)];
    const q = Number(s.quantity || 0);
    soldCount[norm(s.dish)] = (soldCount[norm(s.dish)] || 0) + q;
    if (!dish) {
      if (norm(s.dish)) {
        unmatchedSalesQty += q;
        unmatchedSalesByName[s.dish] = (unmatchedSalesByName[s.dish] || 0) + q;
      }
      return;
    }
    totalRevenue += q * Number(dish.price || 0);
    dish.ingredients.forEach((ing) => {
      const k = norm(ing.name);
      const { value, dim } = toBase(ing.qty, ing.unit);
      expectedBase[k] = (expectedBase[k] || 0) + q * value;
      expectedDims[k] = expectedDims[k] || new Set();
      expectedDims[k].add(dim);
    });
  });
  // dishes may also declare ingredients that were never sold this period — still register their dimension
  dishes.forEach((d) => d.ingredients.forEach((ing) => {
    const k = norm(ing.name);
    if (!k) return;
    const { dim } = toBase(ing.qty, ing.unit);
    expectedDims[k] = expectedDims[k] || new Set();
    expectedDims[k].add(dim);
  }));

  const allKeys = Array.from(new Set([...Object.keys(purchasedBase), ...Object.keys(expectedBase), ...Array.from(menuIngredientKeys)]));

  const unitCostBase = {};
  Object.keys(purchasedBase).forEach((k) => {
    unitCostBase[k] = purchasedBase[k] > 0 ? purchasedCost[k] / purchasedBase[k] : 0;
  });

  const ingredientRows = [];
  const unmatchedRows = [];

  allKeys.forEach((k) => {
    const inMenu = menuIngredientKeys.has(k);
    const wasPurchased = purchasedBase[k] !== undefined;

    if (!inMenu && wasPurchased) {
      // Purchased but never appears in any recipe — likely a naming mismatch or a non-recipe item
      unmatchedRows.push({
        key: k,
        name: k.charAt(0).toUpperCase() + k.slice(1),
        spend: purchasedCost[k] || 0,
        entries: purchasedEntries[k] || 0,
        unit: purchasedEntries[k + "__base"] || "",
      });
      return;
    }
    if (!inMenu) return; // neither purchased nor in menu — nothing to show

    const dims = new Set([...(purchasedDims[k] || []), ...(expectedDims[k] || [])]);
    const mismatch = dims.size > 1;

    if (mismatch) {
      ingredientRows.push({
        key: k, name: k.charAt(0).toUpperCase() + k.slice(1), status: "mismatch",
        purchased: null, used: null, waste: 0, wasteCost: 0, shortage: 0, unit: "",
      });
      return;
    }

    const base = purchasedEntries[k + "__base"] || Array.from(dims)[0]?.split(":")[1] || classifyUnit("").base;
    const purchased = purchasedBase[k] || 0;
    const used = expectedBase[k] || 0;
    const waste = Math.max(purchased - used, 0);
    const shortage = Math.max(used - purchased, 0);
    ingredientRows.push({
      key: k, name: k.charAt(0).toUpperCase() + k.slice(1), status: "ok",
      unit: base, purchased, used, waste,
      wasteCost: waste * (unitCostBase[k] || 0), shortage,
    });
  });
  ingredientRows.sort((a, b) => b.wasteCost - a.wasteCost);
  unmatchedRows.sort((a, b) => b.spend - a.spend);

  const dishRows = dishes.map((d) => {
    const cost = d.ingredients.reduce((sum, ing) => {
      const k = norm(ing.name);
      const dims = new Set([...(purchasedDims[k] || []), ...(expectedDims[k] || [])]);
      if (dims.size > 1) return sum; // unit mismatch — cost for this ingredient can't be trusted, skip rather than guess
      const { value } = toBase(ing.qty, ing.unit);
      return sum + value * (unitCostBase[k] || 0);
    }, 0);
    const margin = Number(d.price || 0) - cost;
    const marginPct = d.price ? (margin / d.price) * 100 : 0;
    const sold = soldCount[norm(d.name)] || 0;
    const hasRecipe = d.ingredients.length > 0;
    return { ...d, cost, margin, marginPct, sold, hasRecipe };
  });

  // Overhead is entered per month; prorate it to the span of days the uploaded sales actually cover,
  // then spread it across plates sold — either evenly, or weighted by each dish's prep time.
  const monthlyOverheadTotal = OVERHEAD_KEYS.reduce((s, k) => s + (Number(overhead[k]) || 0), 0);
  const periodDaysUsed = periodDaysFromSales(sales);
  const totalOverhead = monthlyOverheadTotal * (periodDaysUsed / 30);
  const totalSoldAll = dishRows.reduce((s, d) => s + d.sold, 0);
  const totalWeighted = dishRows.reduce((s, d) => s + d.sold * (Number(d.prepTime) || 1), 0);
  const dishRowsFull = dishRows.map((d) => {
    let overheadPerPlate = 0;
    if (overhead.method === "prepTime" && totalWeighted > 0) {
      overheadPerPlate = (Number(d.prepTime) || 1) * (totalOverhead / totalWeighted);
    } else if (totalSoldAll > 0) {
      overheadPerPlate = totalOverhead / totalSoldAll;
    }
    const fullCost = d.cost + overheadPerPlate;
    const fullMargin = Number(d.price || 0) - fullCost;
    const fullMarginPct = d.price ? (fullMargin / d.price) * 100 : 0;
    return { ...d, overheadPerPlate, fullCost, fullMargin, fullMarginPct };
  });

  const totalWasteCost = ingredientRows.reduce((s, r) => s + r.wasteCost, 0);
  const avgMarginPct = dishRowsFull.length ? dishRowsFull.reduce((s, r) => s + r.marginPct, 0) / dishRowsFull.length : 0;
  const avgFullMarginPct = dishRowsFull.length ? dishRowsFull.reduce((s, r) => s + r.fullMarginPct, 0) / dishRowsFull.length : 0;
  const mismatchCount = ingredientRows.filter((r) => r.status === "mismatch").length;

  const unmatchedSalesTop = Object.entries(unmatchedSalesByName).sort((a, b) => b[1] - a[1]).slice(0, 8);

  return { ingredientRows, unmatchedRows, dishRows: dishRowsFull, totalWasteCost, totalRevenue, avgMarginPct, avgFullMarginPct, totalOverhead, monthlyOverheadTotal, periodDaysUsed, mismatchCount, unmatchedSalesQty, unmatchedSalesTop };
}

function Ticket({ children, style }) {
  return (
    <div className="ticket" style={style}>
      {children}
    </div>
  );
}

function TabButton({ active, onClick, icon: Icon, label }) {
  return (
    <button onClick={onClick} className={`tab-btn ${active ? "tab-btn-active" : ""}`}>
      <Icon size={16} strokeWidth={2} />
      <span>{label}</span>
    </button>
  );
}

const CATEGORY_SUGGESTIONS = ["Starters", "Soups", "Salads", "Fish", "Meat", "Pasta", "Pizza", "Sides", "Dessert", "Wine", "Drinks", "Other"];
const catKey = (c) => norm(c) || "uncategorized";
const catLabel = (c) => (c && c.trim()) ? c.trim() : "Uncategorized";

function MenuTab({ dishes, setDishes }) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("");
  const [activeCat, setActiveCat] = useState("All");
  const fileRef = useRef(null);

  const addDish = () => {
    if (!name.trim()) return;
    setDishes([...dishes, { id: uid(), name: name.trim(), price: Number(price) || 0, category: category.trim(), ingredients: [] }]);
    setName(""); setPrice(""); setCategory("");
  };
  const removeDish = (id) => setDishes(dishes.filter((d) => d.id !== id));
  const updateDishField = (id, field, value) => setDishes(dishes.map((d) => d.id === id ? { ...d, [field]: value } : d));
  const addIngredient = (dishId) => {
    setDishes(dishes.map((d) => d.id === dishId ? { ...d, ingredients: [...d.ingredients, { id: uid(), name: "", qty: "", unit: "g" }] } : d));
  };
  const updateIngredient = (dishId, ingId, field, value) => {
    setDishes(dishes.map((d) => d.id === dishId ? {
      ...d, ingredients: d.ingredients.map((i) => i.id === ingId ? { ...i, [field]: value } : i)
    } : d));
  };
  const removeIngredient = (dishId, ingId) => {
    setDishes(dishes.map((d) => d.id === dishId ? { ...d, ingredients: d.ingredients.filter((i) => i.id !== ingId) } : d));
  };

  const handleBulkUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: (res) => {
        const next = [...dishes];
        const byKey = {};
        next.forEach((d) => { byKey[norm(d.name)] = d; });
        res.data.forEach((row) => {
          const dishName = (row.dish || row.name || "").trim();
          if (!dishName) return;
          const k = norm(dishName);
          let dish = byKey[k];
          if (!dish) {
            dish = { id: uid(), name: dishName, price: Number(row.price) || 0, category: (row.category || "").trim(), prepTime: row.prepTime ? Number(row.prepTime) : "", ingredients: [] };
            byKey[k] = dish;
            next.push(dish);
          } else {
            if (row.price) dish.price = Number(row.price) || dish.price;
            if (row.category) dish.category = row.category.trim();
            if (row.prepTime) dish.prepTime = Number(row.prepTime) || dish.prepTime;
          }
          if (row.ingredient) {
            dish.ingredients = [...dish.ingredients, { id: uid(), name: (row.ingredient || "").trim(), qty: row.qty || row.quantity || "", unit: row.unit || "g" }];
          }
        });
        setDishes(next);
      }
    });
    e.target.value = "";
  };

  const categories = Array.from(new Set(dishes.map((d) => catLabel(d.category))));
  const filtered = activeCat === "All" ? dishes : dishes.filter((d) => catLabel(d.category) === activeCat);

  return (
    <div>
      <div className="panel">
        <p className="panel-label">Add a dish</p>
        <div className="row-form">
          <input placeholder="Dish name" value={name} onChange={(e) => setName(e.target.value)} className="input" style={{ flex: 2 }} />
          <input placeholder="Category" list="cat-suggestions" value={category} onChange={(e) => setCategory(e.target.value)} className="input" style={{ flex: 1 }} />
          <datalist id="cat-suggestions">{CATEGORY_SUGGESTIONS.map((c) => <option key={c} value={c} />)}</datalist>
          <input placeholder="Price (€)" type="number" value={price} onChange={(e) => setPrice(e.target.value)} className="input" style={{ flex: 1 }} />
          <button onClick={addDish} className="btn-brass"><Plus size={16} /> Add dish</button>
        </div>
      </div>

      <div className="panel panel-row">
        <div>
          <p className="panel-label" style={{ marginBottom: 4 }}>Bulk upload menu</p>
          <p className="panel-hint">Columns: dish, category, price, ingredient, qty, unit, prepTime (optional, minutes) — one row per ingredient, repeat the dish name for each of its ingredients</p>
        </div>
        <div className="btn-row">
          <button onClick={() => fileRef.current.click()} className="btn-outline"><Upload size={15} /> Upload menu CSV</button>
          <input ref={fileRef} type="file" accept=".csv" onChange={handleBulkUpload} style={{ display: "none" }} />
        </div>
      </div>

      {dishes.length > 0 && (
        <div className="pill-row">
          <button onClick={() => setActiveCat("All")} className={`pill ${activeCat === "All" ? "pill-active" : ""}`}>All ({dishes.length})</button>
          {categories.map((c) => (
            <button key={c} onClick={() => setActiveCat(c)} className={`pill ${activeCat === c ? "pill-active" : ""}`}>
              {c} ({dishes.filter((d) => catLabel(d.category) === c).length})
            </button>
          ))}
        </div>
      )}

      <div className="ticket-grid">
        {filtered.map((d) => (
          <Ticket key={d.id}>
            <div className="ticket-head">
              <div style={{ flex: 1 }}>
                <p className="ticket-title">{d.name}</p>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                  <input value={d.category || ""} list="cat-suggestions" placeholder="Category" onChange={(e) => updateDishField(d.id, "category", e.target.value)} className="cat-tag-input" />
                </div>
                <p className="ticket-sub" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {money(d.price)} per plate
                  <span className="prep-tag"><Clock size={10} /><input type="number" value={d.prepTime ?? ""} placeholder="—" onChange={(e) => updateDishField(d.id, "prepTime", e.target.value)} className="prep-input" /> min</span>
                </p>
              </div>
              <button onClick={() => removeDish(d.id)} className="icon-btn"><Trash2 size={15} /></button>
            </div>
            <div className="ticket-body">
              {d.ingredients.map((ing) => (
                <div key={ing.id} className="ing-row">
                  <input placeholder="Ingredient" value={ing.name} onChange={(e) => updateIngredient(d.id, ing.id, "name", e.target.value)} className="input-mini" style={{ flex: "2 1 0" }} />
                  <input placeholder="Qty" type="number" inputMode="decimal" value={ing.qty} onChange={(e) => updateIngredient(d.id, ing.id, "qty", e.target.value)} className="input-mini qty-input" style={{ flex: "1 1 0" }} />
                  <select value={ing.unit} onChange={(e) => updateIngredient(d.id, ing.id, "unit", e.target.value)} className="input-mini" style={{ flex: "0 1 52px" }}>
                    <option value="g">g</option><option value="ml">ml</option><option value="unit">unit</option><option value="kg">kg</option><option value="l">l</option>
                  </select>
                  <button onClick={() => removeIngredient(d.id, ing.id)} className="icon-btn-sm"><X size={12} /></button>
                </div>
              ))}
              <button onClick={() => addIngredient(d.id)} className="btn-ghost-sm"><Plus size={13} /> Add ingredient</button>
            </div>
          </Ticket>
        ))}
      </div>
      {dishes.length === 0 && <p className="empty-note">No dishes yet. Add your first dish above, or bulk-upload a whole menu via CSV.</p>}
      {dishes.length > 0 && filtered.length === 0 && <p className="empty-note">No dishes in this category.</p>}
    </div>
  );
}

function CsvTable({ title, icon: Icon, rows, setRows, columns, sampleHint, onImportSample }) {
  const fileRef = useRef(null);

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: (res) => {
        const parsed = res.data.map((r) => {
          const row = { id: uid() };
          columns.forEach((c) => { row[c.key] = r[c.key] ?? r[c.label] ?? ""; });
          return row;
        });
        setRows([...rows, ...parsed]);
      }
    });
    e.target.value = "";
  };

  const addRow = () => {
    const row = { id: uid() };
    columns.forEach((c) => { row[c.key] = ""; });
    setRows([...rows, row]);
  };
  const updateRow = (id, key, value) => setRows(rows.map((r) => r.id === id ? { ...r, [key]: value } : r));
  const removeRow = (id) => setRows(rows.filter((r) => r.id !== id));

  return (
    <div>
      <div className="panel panel-row">
        <div>
          <p className="panel-label"><Icon size={15} style={{ marginRight: 6, verticalAlign: -2 }} />{title}</p>
          <p className="panel-hint">{sampleHint}</p>
        </div>
        <div className="btn-row">
          <button onClick={() => fileRef.current.click()} className="btn-outline"><Upload size={15} /> Upload CSV</button>
          <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} style={{ display: "none" }} />
          <button onClick={addRow} className="btn-outline"><Plus size={15} /> Add row</button>
          {onImportSample && <button onClick={onImportSample} className="btn-ghost-sm">Load sample</button>}
        </div>
      </div>

      <div className="data-table-wrap">
        <table className="data-table">
          <thead>
            <tr>{columns.map((c) => <th key={c.key}>{c.label}</th>)}<th></th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                {columns.map((c) => (
                  <td key={c.key}>
                    <input value={r[c.key] ?? ""} onChange={(e) => updateRow(r.id, c.key, e.target.value)} className="cell-input" type={c.type || "text"} />
                  </td>
                ))}
                <td><button onClick={() => removeRow(r.id)} className="icon-btn-sm"><X size={12} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="empty-note">No rows yet. Upload a CSV or add a row manually.</p>}
      </div>
    </div>
  );
}

function KpiCard({ label, value, tone, sub }) {
  return (
    <div className={`kpi kpi-${tone || "neutral"}`}>
      <p className="kpi-label">{label}</p>
      <p className="kpi-value">{value}</p>
      {sub && <p className="kpi-sub">{sub}</p>}
    </div>
  );
}

function DashboardTab({ analysis }) {
  const { ingredientRows, unmatchedRows, dishRows, totalWasteCost, totalRevenue, avgMarginPct, avgFullMarginPct, totalOverhead, mismatchCount, unmatchedSalesQty, unmatchedSalesTop } = analysis;
  const [ingredientSearch, setIngredientSearch] = useState("");
  const [dishSearch, setDishSearch] = useState("");
  const [dishCat, setDishCat] = useState("All");
  const topWaste = ingredientRows.filter((r) => r.status === "ok" && r.wasteCost > 0).slice(0, 5);
  const totalSoldMatched = dishRows.reduce((s, d) => s + d.sold, 0);
  const totalSoldAll = totalSoldMatched + unmatchedSalesQty;
  const unmatchedSalesPct = totalSoldAll > 0 ? (unmatchedSalesQty / totalSoldAll) * 100 : 0;

  return (
    <div>
      <div className="kpi-grid">
        <KpiCard label="Total waste cost" value={money(totalWasteCost)} tone="danger" sub="in uploaded period" />
        <KpiCard label="Total revenue" value={money(totalRevenue)} tone="neutral" sub="from sales uploaded" />
        <KpiCard label="Food-cost margin" value={`${num(avgMarginPct, 0)}%`} tone={avgMarginPct >= 0 ? "good" : "danger"} sub="ingredients only" />
        <KpiCard label="Full margin" value={`${num(avgFullMarginPct, 0)}%`} tone={avgFullMarginPct >= 0 ? "good" : "danger"} sub="incl. labor + energy" />
        {unmatchedSalesQty > 0 && (
          <KpiCard label="Sales not matched to menu" value={`${num(unmatchedSalesPct, 0)}%`} tone={unmatchedSalesPct > 10 ? "danger" : "neutral"} sub={`${num(unmatchedSalesQty, 0)} units invisible to this analysis`} />
        )}
      </div>

      {(mismatchCount > 0 || unmatchedRows.length > 0 || unmatchedSalesQty > 0) && (
        <div className="warn-banner">
          <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>
            {mismatchCount > 0 && <>{mismatchCount} ingredient{mismatchCount > 1 ? "s" : ""} {mismatchCount > 1 ? "have" : "has"} mixed units that can't be compared (see "Fix units" below). </>}
            {unmatchedRows.length > 0 && <>{unmatchedRows.length} purchased item{unmatchedRows.length > 1 ? "s" : ""} didn't match anything on the menu — see "Unmatched purchases" below. </>}
            {unmatchedSalesQty > 0 && (
              <>{num(unmatchedSalesQty, 0)} sold units ({num(unmatchedSalesPct, 0)}% of all sales) didn't match any menu item, so they're excluded from revenue and waste — mostly {unmatchedSalesTop.slice(0, 4).map(([name]) => name).join(", ")}. These likely need a price and recipe added, or are variable-priced daily specials worth tracking with an average price.</>
            )}
          </span>
        </div>
      )}

      <p className="section-title">Top wasted ingredients</p>
      {topWaste.length === 0 ? (
        <p className="empty-note">No waste detected yet — add menu, purchase, and sales data first.</p>
      ) : (
        <div className="chart-wrap">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={topWaste} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#3A3D34" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: "#B9B6A8", fontSize: 11, fontFamily: "IBM Plex Mono, monospace" }} axisLine={{ stroke: "#3A3D34" }} tickLine={false} />
              <YAxis tick={{ fill: "#B9B6A8", fontSize: 11, fontFamily: "IBM Plex Mono, monospace" }} axisLine={{ stroke: "#3A3D34" }} tickLine={false} />
              <Tooltip contentStyle={{ background: "#242721", border: "1px solid #3A3D34", borderRadius: 6, fontFamily: "IBM Plex Mono, monospace", fontSize: 12 }}
                labelStyle={{ color: "#EFEAE0" }} formatter={(v) => money(v)} />
              <Bar dataKey="wasteCost" radius={[3, 3, 0, 0]}>
                {topWaste.map((_, i) => <Cell key={i} fill="#B5432E" />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <p className="section-title">Waste and shortages by ingredient</p>
      <input placeholder="Search ingredients…" value={ingredientSearch} onChange={(e) => setIngredientSearch(e.target.value)} className="input" style={{ marginBottom: 10, width: "100%", maxWidth: 320 }} />
      <div className="data-table-wrap">
        <table className="data-table">
          <thead><tr><th>Ingredient</th><th>Purchased</th><th>Used (expected)</th><th>Waste</th><th>Waste cost</th><th>Shortage</th></tr></thead>
          <tbody>
            {ingredientRows.filter((r) => r.name.toLowerCase().includes(ingredientSearch.toLowerCase())).map((r) => (
              <tr key={r.key}>
                <td>{r.name}</td>
                {r.status === "mismatch" ? (
                  <td colSpan={5}>
                    <span className="mismatch-badge"><AlertTriangle size={11} /> Fix units — this ingredient is entered in different, incompatible units across the menu and purchases (e.g. grams vs. units). Make them consistent to see waste here.</span>
                  </td>
                ) : (
                  <>
                    <td className="mono">{formatQty(r.purchased, r.unit)}</td>
                    <td className="mono">{formatQty(r.used, r.unit)}</td>
                    <td className="mono" style={{ color: r.waste > 0 ? "#D9765F" : "inherit" }}>{formatQty(r.waste, r.unit)}</td>
                    <td className="mono" style={{ color: r.waste > 0 ? "#D9765F" : "inherit" }}>{money(r.wasteCost)}</td>
                    <td className="mono" style={{ color: r.shortage > 0 ? "#C99A3D" : "inherit" }}>
                      {r.shortage > 0 ? <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><AlertTriangle size={11} />{formatQty(r.shortage, r.unit)}</span> : "—"}
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {ingredientRows.length === 0 && <p className="empty-note">Nothing to show yet.</p>}
      </div>

      {unmatchedRows.length > 0 && (
        <>
          <p className="section-title">Unmatched purchases</p>
          <p className="panel-hint" style={{ marginBottom: 10 }}>These items were purchased but don't match any ingredient on the menu — check for spelling differences, or they may not be recipe items (e.g. supplies). They're excluded from the waste totals above.</p>
          <div className="data-table-wrap">
            <table className="data-table">
              <thead><tr><th>Item</th><th>Purchase entries</th><th>Total spend</th></tr></thead>
              <tbody>
                {unmatchedRows.map((r) => (
                  <tr key={r.key}>
                    <td>{r.name}</td>
                    <td className="mono">{r.entries}</td>
                    <td className="mono">{money(r.spend)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <p className="section-title">Dish profitability</p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
        <input placeholder="Search dishes…" value={dishSearch} onChange={(e) => setDishSearch(e.target.value)} className="input" style={{ width: "100%", maxWidth: 320 }} />
      </div>
      {dishRows.length > 0 && (
        <div className="pill-row">
          <button onClick={() => setDishCat("All")} className={`pill ${dishCat === "All" ? "pill-active" : ""}`}>All ({dishRows.length})</button>
          {Array.from(new Set(dishRows.map((d) => catLabel(d.category)))).map((c) => (
            <button key={c} onClick={() => setDishCat(c)} className={`pill ${dishCat === c ? "pill-active" : ""}`}>
              {c} ({dishRows.filter((d) => catLabel(d.category) === c).length})
            </button>
          ))}
        </div>
      )}
      <div className="data-table-wrap">
        <table className="data-table">
          <thead><tr><th>Dish</th><th>Category</th><th>Sold</th><th>Food cost</th><th>Overhead / plate</th><th>Full cost</th><th>Price</th><th>Full margin</th><th>Full margin %</th></tr></thead>
          <tbody>
            {dishRows
              .filter((d) => (dishCat === "All" || catLabel(d.category) === dishCat) && d.name.toLowerCase().includes(dishSearch.toLowerCase()))
              .sort((a, b) => (b.sold * b.price) - (a.sold * a.price))
              .map((d) => (
              <tr key={d.id}>
                <td>{d.name}</td>
                <td style={{ color: "#9C9A8C", fontSize: 11.5 }}>{catLabel(d.category)}</td>
                <td className="mono">{d.sold}</td>
                <td className="mono">{money(d.cost)}</td>
                <td className="mono" style={{ color: "#9C9A8C" }}>{money(d.overheadPerPlate)}</td>
                <td className="mono">{money(d.fullCost)}</td>
                <td className="mono">{money(d.price)}</td>
                <td className="mono" style={{ color: d.fullMargin >= 0 ? "#8FA37F" : "#D9765F" }}>{money(d.fullMargin)}</td>
                <td className="mono" style={{ color: d.fullMargin >= 0 ? "#8FA37F" : "#D9765F" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                    {d.fullMargin >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    {num(d.fullMarginPct, 0)}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {dishRows.length === 0 && <p className="empty-note">Add dishes on the Menu tab to see profitability here.</p>}
      </div>
    </div>
  );
}

function OverheadTab({ overhead, setOverhead, analysis }) {
  const set = (field) => (e) => setOverhead({ ...overhead, [field]: e.target.value });
  const { dishRows, totalOverhead, monthlyOverheadTotal, periodDaysUsed } = analysis;
  const totalSold = dishRows.reduce((s, d) => s + d.sold, 0);
  const monthlyLabor = (Number(overhead.kitchenLabor) || 0) + (Number(overhead.tableLabor) || 0) + (Number(overhead.otherLabor) || 0);

  return (
    <div>
      <div className="panel">
        <p className="panel-label">Labor — average per month (€)</p>
        <div className="overhead-grid">
          <div className="overhead-field">
            <label className="overhead-label"><ChefHat size={13} /> Kitchen labor</label>
            <input type="number" value={overhead.kitchenLabor} onChange={set("kitchenLabor")} className="input" />
          </div>
          <div className="overhead-field">
            <label className="overhead-label"><Users size={13} /> Table service labor</label>
            <input type="number" value={overhead.tableLabor} onChange={set("tableLabor")} className="input" />
          </div>
          <div className="overhead-field">
            <label className="overhead-label"><MoreHorizontal size={13} /> Other labor</label>
            <input type="number" value={overhead.otherLabor} onChange={set("otherLabor")} className="input" />
          </div>
        </div>
      </div>

      <div className="panel">
        <p className="panel-label">Facilities and other — average per month (€)</p>
        <div className="overhead-grid">
          <div className="overhead-field">
            <label className="overhead-label"><Building2 size={13} /> Building cost</label>
            <input type="number" value={overhead.buildingCost} onChange={set("buildingCost")} className="input" />
          </div>
          <div className="overhead-field">
            <label className="overhead-label"><Zap size={13} /> Energy</label>
            <input type="number" value={overhead.energyCost} onChange={set("energyCost")} className="input" />
          </div>
          <div className="overhead-field">
            <label className="overhead-label"><Droplet size={13} /> Water</label>
            <input type="number" value={overhead.waterCost} onChange={set("waterCost")} className="input" />
          </div>
          <div className="overhead-field">
            <label className="overhead-label"><CircleDollarSign size={13} /> Others</label>
            <input type="number" value={overhead.otherCost} onChange={set("otherCost")} className="input" />
          </div>
        </div>
        <p className="panel-hint" style={{ marginTop: 10 }}>"Others" covers anything not listed above — insurance, software/POS subscriptions, marketing, maintenance, and so on.</p>
      </div>

      <div className="panel panel-row">
        <div>
          <p className="panel-label" style={{ marginBottom: 4 }}>Prorated to your uploaded data</p>
          <p className="panel-hint">Your sales data spans {periodDaysUsed} day{periodDaysUsed === 1 ? "" : "s"}. At {money(monthlyOverheadTotal)}/month total (labor {money(monthlyLabor)} + facilities {money(monthlyOverheadTotal - monthlyLabor)}), that's about <strong style={{ color: "#C99A3D" }}>{money(totalOverhead)}</strong> allocated to this period.</p>
        </div>
      </div>

      <div className="panel">
        <p className="panel-label">How to spread it across dishes</p>
        <div className="method-row">
          <button onClick={() => setOverhead({ ...overhead, method: "even" })} className={`method-btn ${overhead.method === "even" ? "method-btn-active" : ""}`}>
            <p className="method-title">Evenly per plate</p>
            <p className="method-desc">Same overhead added to every dish, regardless of how long it takes to prepare. Simple, but rough — a quick salad carries the same overhead as a slow-cooked steak.</p>
          </button>
          <button onClick={() => setOverhead({ ...overhead, method: "prepTime" })} className={`method-btn ${overhead.method === "prepTime" ? "method-btn-active" : ""}`}>
            <p className="method-title">Weighted by prep time</p>
            <p className="method-desc">Dishes that take longer to prepare absorb more labor and energy cost. More accurate — set prep time (minutes) per dish on the Menu tab.</p>
          </button>
        </div>
      </div>

      <div className="kpi-grid">
        <KpiCard label="Overhead this period" value={money(totalOverhead)} tone="neutral" sub={`prorated from ${money(monthlyOverheadTotal)}/mo`} />
        <KpiCard label="Plates sold" value={totalSold} tone="neutral" />
        <KpiCard label="Avg overhead per plate" value={totalSold ? money(totalOverhead / totalSold) : "—"} tone="neutral" sub="blended across the menu" />
      </div>
    </div>
  );
}

const median = (arr) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

const MATRIX_INFO = {
  star: { label: "Star", icon: Star, color: "#8FA37F", text: "Popular and profitable — your best performer. Feature it prominently and protect the recipe cost." },
  plowhorse: { label: "Plowhorse", icon: ArrowUpRight, color: "#C99A3D", text: "Sells well but the margin is thin. Since customers already choose it, it can likely absorb a modest price increase or a small portion/cost trim." },
  puzzle: { label: "Puzzle", icon: Lightbulb, color: "#9C9A8C", text: "Profitable but underordered. Rather than cutting the price, try promoting it — better menu placement, a staff recommendation, or a photo." },
  dog: { label: "Dog", icon: ArrowDownRight, color: "#D9765F", text: "Low popularity and low margin. Worth reworking the recipe, repricing, or removing it from the menu." },
};

function computeRecommendations(analysis) {
  const { dishRows, ingredientRows } = analysis;
  const withRecipe = dishRows.filter((d) => d.hasRecipe);
  const noRecipe = dishRows.filter((d) => !d.hasRecipe);

  const byCategory = {};
  withRecipe.forEach((d) => {
    const cat = catLabel(d.category);
    byCategory[cat] = byCategory[cat] || [];
    byCategory[cat].push(d);
  });

  const matrix = [];
  const tooSmallCategories = [];
  Object.entries(byCategory).forEach(([cat, items]) => {
    if (items.length < 3) {
      tooSmallCategories.push({ category: cat, count: items.length });
      return;
    }
    // Compare items only against others in the same category — a rare bottle of
    // spirits and a fast-moving coffee were never meant to sit on the same scale.
    const popMedian = median(items.map((d) => d.sold));
    const marginMedian = median(items.map((d) => d.fullMarginPct));
    const catAvgMargin = items.reduce((s, d) => s + d.fullMarginPct, 0) / items.length;
    items.forEach((d) => {
      const popular = d.sold >= popMedian;
      const profitable = d.fullMarginPct >= marginMedian;
      const cls = popular && profitable ? "star" : popular && !profitable ? "plowhorse" : !popular && profitable ? "puzzle" : "dog";
      let suggestedPrice = null;
      if ((cls === "plowhorse" || cls === "dog") && catAvgMargin < 100) {
        const raw = d.fullCost / (1 - catAvgMargin / 100);
        if (raw > d.price) suggestedPrice = Math.round(raw * 2) / 2;
      }
      matrix.push({ ...d, cls, suggestedPrice });
    });
  });

  const wasteAlerts = ingredientRows
    .filter((r) => r.status === "ok" && r.wasteCost > 0)
    .slice(0, 8)
    .map((r) => {
      const wastePct = r.purchased > 0 ? (r.waste / r.purchased) * 100 : 0;
      return { key: r.key, type: "waste", name: r.name, wasteCost: r.wasteCost, text: `Wasting ${formatQty(r.waste, r.unit)} (${num(wastePct, 0)}% of what was purchased, ${money(r.wasteCost)}). Consider trimming the next order by roughly ${num(Math.min(wastePct, 50), 0)}% or checking portion sizes.` };
    });

  const shortageAlerts = ingredientRows
    .filter((r) => r.status === "ok" && r.shortage > 0)
    .sort((a, b) => b.shortage - a.shortage)
    .slice(0, 8)
    .map((r) => ({ key: r.key, type: "shortage", name: r.name, text: `Ran short by ${formatQty(r.shortage, r.unit)} — sales likely outpaced what was purchased. Consider increasing the next order to avoid running out mid-service.` }));

  return { matrix, wasteAlerts, shortageAlerts, noRecipe, tooSmallCategories };
}

function RecommendationsTab({ analysis }) {
  const { matrix, wasteAlerts, shortageAlerts, noRecipe, tooSmallCategories } = computeRecommendations(analysis);
  const groups = ["star", "plowhorse", "puzzle", "dog"];
  const [activeCat, setActiveCat] = useState("All");

  const categories = Array.from(new Set(matrix.map((d) => catLabel(d.category))));
  const filtered = activeCat === "All" ? matrix : matrix.filter((d) => catLabel(d.category) === activeCat);

  return (
    <div>
      <p className="panel-hint" style={{ marginBottom: 14 }}>
        Each dish is compared only against others in its own category — a bottle of wine and a coffee were never meant to sit on the same scale. Based on how a dish sells versus its fully-loaded margin within its category (classic menu-engineering: Stars, Plowhorses, Puzzles, Dogs), plus which ingredients are running as waste or shortage. These are starting points, not orders.
      </p>

      {(noRecipe.length > 0 || tooSmallCategories.length > 0) && (
        <div className="warn-banner" style={{ marginBottom: 16 }}>
          <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>
            {noRecipe.length > 0 && <>{noRecipe.length} item{noRecipe.length > 1 ? "s" : ""} without ingredients defined (bundle menus, composite items) excluded from comparison — they'd otherwise show a false 100% margin. </>}
            {tooSmallCategories.length > 0 && <>{tooSmallCategories.length} categor{tooSmallCategories.length > 1 ? "ies" : "y"} had fewer than 3 items and weren't classified (too small a sample to compare fairly): {tooSmallCategories.map((c) => `${c.category} (${c.count})`).join(", ")}.</>}
          </span>
        </div>
      )}

      {matrix.length > 0 && (
        <div className="pill-row">
          <button onClick={() => setActiveCat("All")} className={`pill ${activeCat === "All" ? "pill-active" : ""}`}>All ({matrix.length})</button>
          {categories.map((c) => (
            <button key={c} onClick={() => setActiveCat(c)} className={`pill ${activeCat === c ? "pill-active" : ""}`}>
              {c} ({matrix.filter((d) => catLabel(d.category) === c).length})
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="empty-note">Add dishes and sales data to see menu recommendations.</p>
      ) : (
        <div className="rec-grid">
          {groups.map((g) => {
            const items = filtered.filter((d) => d.cls === g).sort((a, b) => (b.sold * b.price) - (a.sold * a.price));
            if (items.length === 0) return null;
            const info = MATRIX_INFO[g];
            const Icon = info.icon;
            return (
              <div key={g} className="rec-card">
                <div className="rec-card-head" style={{ color: info.color }}>
                  <Icon size={15} />
                  <p className="rec-card-title" style={{ color: info.color }}>{info.label} <span className="rec-count">({items.length})</span></p>
                </div>
                <p className="rec-card-desc">{info.text}</p>
                <div className="rec-dish-list" style={{ maxHeight: 260, overflowY: "auto" }}>
                  {items.map((d) => (
                    <div key={d.id} className="rec-dish-row">
                      <span>{d.name}</span>
                      <span className="mono" style={{ color: "#9C9A8C", fontSize: 11.5 }}>
                        {num(d.fullMarginPct, 0)}% margin · {d.sold} sold
                        {d.suggestedPrice && <> · try {money(d.suggestedPrice)}</>}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {(wasteAlerts.length > 0 || shortageAlerts.length > 0) && (
        <>
          <p className="section-title">Ingredient alerts</p>
          <div className="alert-list">
            {wasteAlerts.map((a) => (
              <div key={a.key} className="alert-row">
                <AlertTriangle size={14} style={{ color: "#D9765F", flexShrink: 0, marginTop: 1 }} />
                <span><strong style={{ color: "#EFEAE0" }}>{a.name}</strong> — {a.text}</span>
              </div>
            ))}
            {shortageAlerts.map((a) => (
              <div key={a.key} className="alert-row">
                <AlertTriangle size={14} style={{ color: "#C99A3D", flexShrink: 0, marginTop: 1 }} />
                <span><strong style={{ color: "#EFEAE0" }}>{a.name}</strong> — {a.text}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function LeakStop() {
  const [tab, setTab] = useState("dashboard");
  const [dishes, setDishes] = useState(SAMPLE_DISHES);
  const [purchases, setPurchases] = useState(SAMPLE_PURCHASES);
  const [sales, setSales] = useState(SAMPLE_SALES);
  const [overhead, setOverhead] = useState(SAMPLE_OVERHEAD);
  const [loaded, setLoaded] = useState(false);
  const [saveState, setSaveState] = useState("idle");
  const [usingSample, setUsingSample] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [d, p, s, o] = await Promise.all([
          window.storage.get("leakstop-dishes").catch(() => null),
          window.storage.get("leakstop-purchases").catch(() => null),
          window.storage.get("leakstop-sales").catch(() => null),
          window.storage.get("leakstop-overhead").catch(() => null),
        ]);
        if (d) { setDishes(JSON.parse(d.value)); setUsingSample(false); }
        if (p) { setPurchases(JSON.parse(p.value)); setUsingSample(false); }
        if (s) { setSales(JSON.parse(s.value)); setUsingSample(false); }
        if (o) { setOverhead(JSON.parse(o.value)); setUsingSample(false); }
      } catch (e) { /* first run, nothing stored yet — keep the sample data showing */ }
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    setSaveState("saving");
    const t = setTimeout(async () => {
      try {
        await window.storage.set("leakstop-dishes", JSON.stringify(dishes));
        await window.storage.set("leakstop-purchases", JSON.stringify(purchases));
        await window.storage.set("leakstop-sales", JSON.stringify(sales));
        await window.storage.set("leakstop-overhead", JSON.stringify(overhead));
        setSaveState("saved");
      } catch (e) { setSaveState("error"); }
    }, 500);
    return () => clearTimeout(t);
  }, [dishes, purchases, sales, overhead, loaded]);

  const loadSample = () => { setDishes(SAMPLE_DISHES); setPurchases(SAMPLE_PURCHASES); setSales(SAMPLE_SALES); setOverhead(SAMPLE_OVERHEAD); setUsingSample(true); };
  const clearAll = () => { setDishes([]); setPurchases([]); setSales([]); setOverhead({ kitchenLabor: 0, tableLabor: 0, otherLabor: 0, buildingCost: 0, energyCost: 0, waterCost: 0, otherCost: 0, method: "even" }); setUsingSample(false); };

  const analysis = computeAnalysis(dishes, purchases, sales, overhead);

  return (
    <div className="app-shell">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
        .app-shell { background:#1B1D19; color:#EFEAE0; font-family:'Space Grotesk',sans-serif; padding:28px 24px 40px; border-radius:14px; }
        .app-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:22px; flex-wrap:wrap; gap:12px; }
        .app-brand { display:flex; align-items:center; gap:10px; }
        .app-brand-mark { width:34px; height:34px; border-radius:8px; background:#C99A3D; display:flex; align-items:center; justify-content:center; color:#1B1D19; }
        .app-title { font-size:19px; font-weight:700; letter-spacing:-0.01em; margin:0; }
        .app-subtitle { font-size:12px; color:#9C9A8C; margin:1px 0 0; font-family:'IBM Plex Mono',monospace; }
        .save-badge { font-size:11px; font-family:'IBM Plex Mono',monospace; color:#8FA37F; opacity:${saveState === "saved" ? 1 : 0.5}; transition:opacity .3s; }
        .header-actions { display:flex; gap:8px; }
        .tabs { display:flex; gap:6px; margin-bottom:22px; border-bottom:1px solid #34372E; padding-bottom:0; flex-wrap:wrap; }
        .tab-btn { display:flex; align-items:center; gap:7px; background:transparent; border:none; color:#9C9A8C; font-family:'Space Grotesk',sans-serif; font-size:13.5px; font-weight:600; padding:10px 14px; cursor:pointer; border-bottom:2px solid transparent; margin-bottom:-1px; transition:color .15s; }
        .tab-btn:hover { color:#EFEAE0; }
        .tab-btn-active { color:#C99A3D; border-bottom:2px solid #C99A3D; }
        .panel { background:#22251F; border:1px solid #34372E; border-radius:10px; padding:16px 18px; margin-bottom:20px; }
        .panel-row { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px; }
        .panel-label { font-size:13px; font-weight:600; margin:0 0 10px; color:#EFEAE0; }
        .panel-hint { font-size:11.5px; color:#8B8A7D; margin:2px 0 0; font-family:'IBM Plex Mono',monospace; }
        .row-form { display:flex; gap:10px; flex-wrap:wrap; }
        .input { background:#1B1D19; border:1px solid #3A3D34; color:#EFEAE0; border-radius:6px; padding:9px 11px; font-size:13px; font-family:'Space Grotesk',sans-serif; outline:none; }
        .input:focus { border-color:#C99A3D; }
        .input-mini { background:#1B1D19; border:1px solid #3A3D34; color:#EFEAE0; border-radius:5px; padding:6px 6px; font-size:12px; font-family:'IBM Plex Mono',monospace; outline:none; width:100%; min-width:0; }
        .input-mini:focus { border-color:#C99A3D; }
        .qty-input { min-width:52px; }
        .qty-input::-webkit-outer-spin-button, .qty-input::-webkit-inner-spin-button { -webkit-appearance:none; margin:0; }
        .qty-input { -moz-appearance:textfield; }
        .btn-brass { display:flex; align-items:center; gap:6px; background:#C99A3D; color:#1B1D19; border:none; border-radius:6px; padding:9px 14px; font-size:13px; font-weight:600; cursor:pointer; font-family:'Space Grotesk',sans-serif; }
        .btn-brass:hover { background:#DBAE52; }
        .btn-outline { display:flex; align-items:center; gap:6px; background:transparent; color:#EFEAE0; border:1px solid #3A3D34; border-radius:6px; padding:8px 13px; font-size:12.5px; font-weight:600; cursor:pointer; font-family:'Space Grotesk',sans-serif; }
        .btn-outline:hover { border-color:#C99A3D; color:#C99A3D; }
        .btn-ghost-sm { background:transparent; color:#8FA37F; border:none; font-size:12px; font-weight:600; cursor:pointer; font-family:'Space Grotesk',sans-serif; padding:6px 4px; display:flex; align-items:center; gap:4px; }
        .btn-row { display:flex; gap:8px; flex-wrap:wrap; }
        .icon-btn { background:transparent; border:none; color:#8B8A7D; cursor:pointer; padding:4px; }
        .icon-btn:hover { color:#B5432E; }
        .icon-btn-sm { background:transparent; border:none; color:#6B6A5F; cursor:pointer; padding:2px; display:flex; }
        .icon-btn-sm:hover { color:#B5432E; }
        .pill-row { display:flex; gap:7px; flex-wrap:wrap; margin-bottom:16px; }
        .pill { background:#22251F; border:1px solid #34372E; color:#9C9A8C; border-radius:999px; padding:6px 13px; font-size:12px; font-weight:600; cursor:pointer; font-family:'Space Grotesk',sans-serif; }
        .pill:hover { border-color:#C99A3D; color:#EFEAE0; }
        .pill-active { background:#C99A3D; border-color:#C99A3D; color:#1B1D19; }
        .cat-tag-input { background:transparent; border:1px dashed #B8B29B; color:#6B6A5F; font-family:'IBM Plex Mono',monospace; font-size:10.5px; text-transform:uppercase; letter-spacing:.03em; border-radius:3px; padding:2px 6px; width:110px; outline:none; }
        .cat-tag-input:focus { border-style:solid; border-color:#8B8A7D; color:#1B1D19; }
        .prep-tag { display:inline-flex; align-items:center; gap:3px; color:#8B8A7D; font-size:10.5px; }
        .prep-input { width:26px; background:transparent; border:none; border-bottom:1px dotted #B8B29B; color:#6B6A5F; font-family:'IBM Plex Mono',monospace; font-size:11px; text-align:right; outline:none; padding:0; }
        .prep-input:focus { border-bottom-style:solid; color:#1B1D19; }
        .ticket-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(270px,1fr)); gap:14px; }
        .ticket { background:#EFEAE0; color:#1B1D19; border-radius:4px; position:relative; padding:14px 14px 12px; background-image: radial-gradient(circle, #1B1D19 3px, transparent 3px); background-position: top -3px left 0, top -3px left 100%; background-size: 16px 16px; background-repeat: repeat-x; }
        .ticket-head { display:flex; align-items:flex-start; justify-content:space-between; border-bottom:1px dashed #B8B29B; padding-bottom:8px; margin-bottom:8px; }
        .ticket-title { font-weight:700; font-size:14px; margin:0; }
        .ticket-sub { font-family:'IBM Plex Mono',monospace; font-size:11px; color:#6B6A5F; margin:3px 0 0; }
        .ticket-body { display:flex; flex-direction:column; gap:6px; }
        .ing-row { display:flex; gap:5px; align-items:center; }
        .empty-note { color:#8B8A7D; font-size:12.5px; font-family:'IBM Plex Mono',monospace; padding:10px 2px; }
        .data-table-wrap { background:#22251F; border:1px solid #34372E; border-radius:10px; overflow-x:auto; margin-bottom:8px; }
        .data-table { width:100%; border-collapse:collapse; font-size:12.5px; }
        .data-table th { text-align:left; font-family:'IBM Plex Mono',monospace; font-size:11px; text-transform:uppercase; letter-spacing:.04em; color:#8B8A7D; font-weight:500; padding:10px 12px; border-bottom:1px solid #34372E; white-space:nowrap; }
        .data-table td { padding:6px 12px; border-bottom:1px solid #2A2D25; }
        .data-table tr:last-child td { border-bottom:none; }
        .mono { font-family:'IBM Plex Mono',monospace; }
        .cell-input { background:transparent; border:none; color:#EFEAE0; font-family:'IBM Plex Mono',monospace; font-size:12px; width:100%; outline:none; padding:4px 2px; }
        .cell-input:focus { background:#1B1D19; border-radius:4px; }
        .kpi-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:12px; margin-bottom:26px; }
        .kpi { border-radius:10px; padding:14px 16px; border:1px solid #34372E; }
        .kpi-neutral { background:#22251F; }
        .kpi-danger { background:#2E211D; border-color:#4A2E26; }
        .kpi-good { background:#20261E; border-color:#334832; }
        .kpi-label { font-size:11px; font-family:'IBM Plex Mono',monospace; color:#9C9A8C; margin:0 0 6px; text-transform:uppercase; letter-spacing:.03em; }
        .kpi-value { font-size:24px; font-weight:700; margin:0; font-family:'IBM Plex Mono',monospace; }
        .kpi-sub { font-size:11px; color:#8B8A7D; margin:4px 0 0; }
        .warn-banner { display:flex; gap:9px; align-items:flex-start; background:#2E2A1D; border:1px solid #4A3F26; color:#D9C186; border-radius:8px; padding:11px 14px; font-size:12px; margin-bottom:20px; line-height:1.5; }
        .mismatch-badge { display:inline-flex; align-items:flex-start; gap:6px; color:#D9C186; font-size:11.5px; font-family:'Space Grotesk',sans-serif; line-height:1.4; }
        .section-title { font-size:13px; font-weight:600; margin:22px 0 10px; color:#C99A3D; text-transform:uppercase; letter-spacing:.03em; }
        .chart-wrap { background:#22251F; border:1px solid #34372E; border-radius:10px; padding:14px 8px 4px; margin-bottom:8px; }
        .overhead-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:14px; }
        .overhead-field { display:flex; flex-direction:column; gap:6px; }
        .overhead-label { display:flex; align-items:center; gap:6px; font-size:12px; color:#9C9A8C; font-weight:600; }
        .method-row { display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:12px; }
        .method-btn { text-align:left; background:#1B1D19; border:1px solid #3A3D34; border-radius:8px; padding:12px 14px; cursor:pointer; font-family:'Space Grotesk',sans-serif; }
        .method-btn:hover { border-color:#8B8A7D; }
        .method-btn-active { border-color:#C99A3D; background:#2A2416; }
        .method-title { font-size:13px; font-weight:600; color:#EFEAE0; margin:0 0 4px; }
        .method-desc { font-size:11.5px; color:#9C9A8C; margin:0; line-height:1.5; }
        .rec-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(260px,1fr)); gap:14px; margin-bottom:22px; }
        .rec-card { background:#22251F; border:1px solid #34372E; border-radius:10px; padding:14px 16px; }
        .rec-card-head { display:flex; align-items:center; gap:7px; margin-bottom:6px; }
        .rec-card-title { font-size:13.5px; font-weight:700; margin:0; }
        .rec-count { font-weight:400; color:#8B8A7D; }
        .rec-card-desc { font-size:11.5px; color:#9C9A8C; line-height:1.5; margin:0 0 10px; }
        .rec-dish-list { display:flex; flex-direction:column; gap:6px; border-top:1px solid #34372E; padding-top:8px; }
        .rec-dish-row { display:flex; align-items:center; justify-content:space-between; gap:8px; font-size:12.5px; }
        .alert-list { display:flex; flex-direction:column; gap:8px; }
        .alert-row { display:flex; gap:9px; align-items:flex-start; background:#22251F; border:1px solid #34372E; border-radius:8px; padding:10px 13px; font-size:12.5px; color:#B9B6A8; line-height:1.5; }
      `}</style>

      <div className="app-header">
        <div className="app-brand">
          <div className="app-brand-mark"><ChefHat size={18} strokeWidth={2.2} /></div>
          <div>
            <p className="app-title">LeakStop</p>
            <p className="app-subtitle">find the leak before it costs you</p>
          </div>
        </div>
        <div className="header-actions">
          <span className="save-badge">{saveState === "saving" ? "saving…" : "saved"}</span>
          <button onClick={loadSample} className="btn-outline">Load sample data</button>
          <button onClick={clearAll} className="btn-outline">Clear all</button>
        </div>
      </div>

      <div className="tabs">
        <TabButton active={tab === "menu"} onClick={() => setTab("menu")} icon={ChefHat} label="Menu" />
        <TabButton active={tab === "purchases"} onClick={() => setTab("purchases")} icon={Package} label="Purchases" />
        <TabButton active={tab === "sales"} onClick={() => setTab("sales")} icon={Receipt} label="Sales" />
        <TabButton active={tab === "overhead"} onClick={() => setTab("overhead")} icon={Calculator} label="Overhead" />
        <TabButton active={tab === "dashboard"} onClick={() => setTab("dashboard")} icon={LayoutDashboard} label="Dashboard" />
        <TabButton active={tab === "recommendations"} onClick={() => setTab("recommendations")} icon={Lightbulb} label="Recommendations" />
      </div>

      {tab === "menu" && <MenuTab dishes={dishes} setDishes={setDishes} />}
      {tab === "purchases" && (
        <CsvTable
          title="Purchase orders" icon={Package} rows={purchases} setRows={setPurchases}
          sampleHint="Columns: item, quantity, unit, unitPrice, date, supplier"
          columns={[
            { key: "item", label: "Item" }, { key: "quantity", label: "Quantity", type: "number" },
            { key: "unit", label: "Unit" }, { key: "unitPrice", label: "Unit price (€)", type: "number" },
            { key: "date", label: "Date" }, { key: "supplier", label: "Supplier" },
          ]}
        />
      )}
      {tab === "sales" && (
        <CsvTable
          title="Sales" icon={Receipt} rows={sales} setRows={setSales}
          sampleHint="Columns: dish, quantity, date"
          columns={[
            { key: "dish", label: "Dish" }, { key: "quantity", label: "Quantity sold", type: "number" }, { key: "date", label: "Date" },
          ]}
        />
      )}
      {tab === "overhead" && <OverheadTab overhead={overhead} setOverhead={setOverhead} analysis={analysis} />}
      {tab === "dashboard" && <DashboardTab analysis={analysis} />}
      {tab === "recommendations" && <RecommendationsTab analysis={analysis} />}

      {usingSample && (
        <div style={{ marginTop: 8 }}>
          <AlertTriangle size={13} style={{ verticalAlign: -2, marginRight: 6, color: "#C99A3D" }} />
          <span style={{ fontSize: 12, color: "#9C9A8C", fontFamily: "IBM Plex Mono, monospace" }}>
            You're looking at sample data for one restaurant. Edit or delete rows on each tab, or hit "Clear all" to start with your own.
          </span>
        </div>
      )}
    </div>
  );
}
