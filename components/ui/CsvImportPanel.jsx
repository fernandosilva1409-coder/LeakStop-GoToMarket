import { Upload, Download } from "lucide-react";
import Button from "./Button";
import ProgressBar from "./ProgressBar";

export default function CsvImportPanel({ title, columnsHint, chooseFileLabel, downloadLabel, status, progress, fileInputRef, onFile, onDownloadTemplate }) {
  return (
    <div className="mt-6 rounded-2xl border border-dashed border-surface-border bg-surface-sunken p-5">
      <p className="font-semibold text-heading">{title}</p>
      <p className="mt-1 font-mono text-[11.5px] text-muted">{columnsHint}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button type="button" variant="secondary" icon={Upload} onClick={() => fileInputRef.current?.click()} disabled={!!progress}>
          {chooseFileLabel}
        </Button>
        <Button type="button" variant="secondary" icon={Download} onClick={onDownloadTemplate}>
          {downloadLabel}
        </Button>
        <input ref={fileInputRef} type="file" accept=".csv" onChange={onFile} className="hidden" />
      </div>
      {status && <p className="mt-2 text-sm text-muted">{status}</p>}
      {progress && <ProgressBar current={progress.current} total={progress.total} />}
    </div>
  );
}
