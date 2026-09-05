'use client';

import { useState, type DragEvent } from 'react';

interface UploadDropzoneProps {
  readonly onFileSelected: (file: File) => void;
  readonly error?: string | undefined;
}

export function UploadDropzone({ onFileSelected, error }: UploadDropzoneProps) {
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDraggingOver(false);
    const file = event.dataTransfer.files?.[0];
    if (file) onFileSelected(file);
  }

  return (
    <div>
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setIsDraggingOver(true);
        }}
        onDragLeave={() => setIsDraggingOver(false)}
        onDrop={handleDrop}
        className={`flex flex-col items-center justify-center border-2 border-dashed px-10 py-12 text-center transition-colors ${
          isDraggingOver ? 'border-slate-900 bg-slate-50' : 'border-slate-300'
        }`}
      >
        <p className="text-body text-slate-700">Drag and drop your shipment history here</p>
        <p className="mt-1 text-caption text-slate-500">or</p>
        <label className="mt-3 inline-block cursor-pointer border border-slate-900 bg-slate-900 px-4 py-2 text-label font-medium text-white hover:bg-slate-800">
          Choose file
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onFileSelected(file);
            }}
          />
        </label>
      </div>
      {error && <p className="mt-3 text-body text-red-700">{error}</p>}
    </div>
  );
}
