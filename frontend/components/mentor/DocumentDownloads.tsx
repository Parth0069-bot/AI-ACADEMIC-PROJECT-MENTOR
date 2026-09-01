"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { notify } from "@/lib/notify";
import { FileText, Loader2, Download } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { BackendError } from "@/lib/backendClient";
import { downloadDocument, DOCUMENT_TYPE_LABELS, type DocumentType } from "@/lib/mentorClient";

const DOCUMENT_TYPES: DocumentType[] = ["synopsis", "methodology", "progress_report"];

interface DocumentDownloadsProps {
  ideaId: string;
}

export function DocumentDownloads({ ideaId }: DocumentDownloadsProps) {
  const [generating, setGenerating] = useState<DocumentType | null>(null);

  async function handleDownload(type: DocumentType) {
    setGenerating(type);
    try {
      await downloadDocument(ideaId, type);
      notify.success(`${DOCUMENT_TYPE_LABELS[type]} downloaded!`);
    } catch (err) {
      toast.error(err instanceof BackendError ? err.message : "Couldn't generate that document -- try again.");
    } finally {
      setGenerating(null);
    }
  }

  return (
    <Card>
      <h3 className="font-display font-semibold text-ink-900 mb-1">Faculty Documents</h3>
      <p className="text-[11px] text-ink-400 mb-4">
        Generated fresh every time, grounded in your latest agent runs and check-ins.
      </p>
      <div className="flex flex-col gap-2">
        {DOCUMENT_TYPES.map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => handleDownload(type)}
            disabled={generating !== null}
            className="flex items-center justify-between gap-2 rounded-xl border border-primary-100 bg-white px-4 py-3 text-sm font-medium text-ink-700 hover:bg-primary-50 disabled:opacity-50 transition-colors"
          >
            <span className="flex items-center gap-2">
              <FileText size={15} className="text-primary-500" />
              {DOCUMENT_TYPE_LABELS[type]}
            </span>
            {generating === type ? (
              <Loader2 size={15} className="animate-spin text-primary-500" />
            ) : (
              <Download size={15} className="text-ink-300" />
            )}
          </button>
        ))}
      </div>
    </Card>
  );
}
