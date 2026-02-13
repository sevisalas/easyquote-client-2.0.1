import { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Paperclip, Trash2, Upload, FileText, Image, File, ChevronDown } from "lucide-react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";

interface Attachment {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  created_at: string;
}

interface PendingFile {
  file: globalThis.File;
  id: string; // temp id for UI
}

export interface DocumentAttachmentsHandle {
  uploadPendingFiles: (documentId: string, documentType: "quote" | "order") => Promise<void>;
  hasPendingFiles: () => boolean;
}

interface DocumentAttachmentsProps {
  quoteId?: string;
  salesOrderId?: string;
  organizationId: string;
  readOnly?: boolean;
}

const MAX_FILES = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const formatFileSize = (bytes: number | null) => {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const getFileIcon = (mimeType: string | null) => {
  if (!mimeType) return <File className="h-4 w-4" />;
  if (mimeType.startsWith("image/")) return <Image className="h-4 w-4" />;
  if (mimeType === "application/pdf") return <FileText className="h-4 w-4" />;
  return <File className="h-4 w-4" />;
};

const DocumentAttachments = forwardRef<DocumentAttachmentsHandle, DocumentAttachmentsProps>(
  function DocumentAttachments(
    { quoteId, salesOrderId, organizationId, readOnly = false },
    ref
  ) {
    const [attachments, setAttachments] = useState<Attachment[]>([]);
    const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
    const [uploading, setUploading] = useState(false);

    const documentId = quoteId || salesOrderId;
    const documentType = quoteId ? "quote" : "order";
    const isPendingMode = !documentId;

    const totalCount = attachments.length + pendingFiles.length;

    // Expose imperative methods
    useImperativeHandle(ref, () => ({
      hasPendingFiles: () => pendingFiles.length > 0,
      uploadPendingFiles: async (docId: string, docType: "quote" | "order") => {
        if (pendingFiles.length === 0) return;
        try {
          const { data: userData } = await supabase.auth.getUser();
          const userId = userData.user?.id;

          for (const pending of pendingFiles) {
            const timestamp = Date.now();
            const storagePath = `${organizationId}/${docType}/${docId}/${timestamp}_${pending.file.name}`;

            const { error: uploadError } = await supabase.storage
              .from("document-attachments")
              .upload(storagePath, pending.file);

            if (uploadError) {
              console.error("Upload error:", uploadError);
              continue;
            }

            const insertData: Record<string, any> = {
              organization_id: organizationId,
              file_name: pending.file.name,
              file_path: storagePath,
              file_size: pending.file.size,
              mime_type: pending.file.type || null,
              created_by: userId,
            };

            if (docType === "quote") insertData.quote_id = docId;
            if (docType === "order") insertData.sales_order_id = docId;

            await (supabase
              .from("document_attachments" as any)
              .insert(insertData) as any);
          }

          setPendingFiles([]);
        } catch (err) {
          console.error("Error uploading pending files:", err);
          toast.error("Error al subir archivos adjuntos");
        }
      },
    }), [pendingFiles, organizationId]);

    const loadAttachments = useCallback(async () => {
      if (!documentId) return;

      let query = (supabase
        .from("document_attachments" as any) as any)
        .select("*")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: true });

      if (quoteId) {
        query = query.eq("quote_id", quoteId);
      } else if (salesOrderId) {
        query = query.eq("sales_order_id", salesOrderId);
      }

      const { data, error } = await query;
      if (error) {
        console.error("Error loading attachments:", error);
        return;
      }
      setAttachments((data as Attachment[]) || []);
    }, [documentId, quoteId, salesOrderId, organizationId]);

    useEffect(() => {
      loadAttachments();
    }, [loadAttachments]);

    const onDrop = useCallback(
      async (acceptedFiles: globalThis.File[]) => {
        if (totalCount + acceptedFiles.length > MAX_FILES) {
          toast.error(`Máximo ${MAX_FILES} archivos por documento`);
          return;
        }

        const oversized = acceptedFiles.filter((f) => f.size > MAX_FILE_SIZE);
        if (oversized.length > 0) {
          toast.error(`Archivos demasiado grandes (máx. 10 MB): ${oversized.map((f) => f.name).join(", ")}`);
          return;
        }

        // Pending mode: just queue files locally
        if (isPendingMode) {
          const newPending = acceptedFiles.map((file) => ({
            file,
            id: `pending-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          }));
          setPendingFiles((prev) => [...prev, ...newPending]);
          toast.success("Archivo(s) listos para adjuntar al guardar");
          return;
        }

        // Normal mode: upload immediately
        setUploading(true);
        try {
          const { data: userData } = await supabase.auth.getUser();
          const userId = userData.user?.id;

          for (const file of acceptedFiles) {
            const timestamp = Date.now();
            const storagePath = `${organizationId}/${documentType}/${documentId}/${timestamp}_${file.name}`;

            const { error: uploadError } = await supabase.storage
              .from("document-attachments")
              .upload(storagePath, file);

            if (uploadError) {
              console.error("Upload error:", uploadError);
              toast.error(`Error subiendo ${file.name}`);
              continue;
            }

            const insertData: Record<string, any> = {
              organization_id: organizationId,
              file_name: file.name,
              file_path: storagePath,
              file_size: file.size,
              mime_type: file.type || null,
              created_by: userId,
            };

            if (quoteId) insertData.quote_id = quoteId;
            if (salesOrderId) insertData.sales_order_id = salesOrderId;

            const { error: insertError } = await (supabase
              .from("document_attachments" as any)
              .insert(insertData) as any);

            if (insertError) {
              console.error("Insert error:", insertError);
              toast.error(`Error registrando ${file.name}`);
            }
          }

          toast.success("Archivo(s) adjuntado(s)");
          await loadAttachments();
        } catch (err) {
          console.error("Error uploading:", err);
          toast.error("Error al subir archivos");
        } finally {
          setUploading(false);
        }
      },
      [documentId, documentType, organizationId, quoteId, salesOrderId, totalCount, isPendingMode, loadAttachments]
    );

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
      onDrop,
      disabled: readOnly || uploading || totalCount >= MAX_FILES,
      maxSize: MAX_FILE_SIZE,
    });

    const handleDelete = async (attachment: Attachment) => {
      try {
        await supabase.storage.from("document-attachments").remove([attachment.file_path]);

        const { error } = await (supabase
          .from("document_attachments" as any)
          .delete()
          .eq("id", attachment.id) as any);

        if (error) throw error;

        toast.success("Archivo eliminado");
        await loadAttachments();
      } catch (err) {
        console.error("Error deleting:", err);
        toast.error("Error al eliminar archivo");
      }
    };

    const handleRemovePending = (pendingId: string) => {
      setPendingFiles((prev) => prev.filter((p) => p.id !== pendingId));
    };

    return (
      <Collapsible defaultOpen={totalCount > 0}>
        <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors py-2 w-full">
          <Paperclip className="h-3.5 w-3.5" />
          <span>Adjuntos</span>
          {totalCount > 0 && (
            <span className="text-xs">({totalCount}/{MAX_FILES})</span>
          )}
          <ChevronDown className="h-3.5 w-3.5 ml-auto transition-transform [[data-state=open]>&]:rotate-180" />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-2 pb-2">
          {/* Saved attachments */}
          {attachments.length > 0 && (
            <div className="space-y-1">
              {attachments.map((att) => (
                <div
                  key={att.id}
                  className="flex items-center justify-between gap-2 p-1.5 bg-muted/30 rounded border border-border text-xs"
                >
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    {getFileIcon(att.mime_type)}
                    <span className="truncate">{att.file_name}</span>
                    <span className="text-muted-foreground flex-shrink-0">
                      {formatFileSize(att.file_size)}
                    </span>
                  </div>
                  {!readOnly && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(att)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Pending files */}
          {pendingFiles.length > 0 && (
            <div className="space-y-1">
              {pendingFiles.map((pf) => (
                <div
                  key={pf.id}
                  className="flex items-center justify-between gap-2 p-1.5 bg-accent/20 rounded border border-dashed border-accent text-xs"
                >
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    {getFileIcon(pf.file.type || null)}
                    <span className="truncate">{pf.file.name}</span>
                    <span className="text-muted-foreground flex-shrink-0">
                      {formatFileSize(pf.file.size)}
                    </span>
                    <span className="text-accent-foreground/70 flex-shrink-0">(pendiente)</span>
                  </div>
                  {!readOnly && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                      onClick={() => handleRemovePending(pf.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Drop zone */}
          {!readOnly && totalCount < MAX_FILES && (
            <div
              {...getRootProps()}
              className={`border border-dashed rounded p-2 text-center cursor-pointer transition-colors text-xs ${
                isDragActive
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50"
              } ${uploading ? "opacity-50 pointer-events-none" : ""}`}
            >
              <input {...getInputProps()} />
              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <Upload className="h-3.5 w-3.5" />
                <span>
                  {uploading
                    ? "Subiendo..."
                    : isDragActive
                    ? "Suelta aquí"
                    : "Arrastra o haz clic para adjuntar"}
                </span>
              </div>
            </div>
          )}

          {totalCount === 0 && readOnly && (
            <p className="text-xs text-muted-foreground">Sin adjuntos</p>
          )}
        </CollapsibleContent>
      </Collapsible>
    );
  }
);

export default DocumentAttachments;
