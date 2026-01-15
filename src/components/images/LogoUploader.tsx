import React, { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, X, Image as ImageIcon, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface LogoUploaderProps {
  currentLogoUrl?: string;
  onLogoChange: (url: string) => void;
  className?: string;
}

export const LogoUploader: React.FC<LogoUploaderProps> = ({
  currentLogoUrl,
  onLogoChange,
  className = "",
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      // Validate file
      if (file.size > 5 * 1024 * 1024) {
        toast.error("El archivo es demasiado grande. Máximo 5MB.");
        return;
      }

      if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
        toast.error("Tipo de archivo no permitido. Use JPG, PNG, WebP o GIF.");
        return;
      }

      setIsUploading(true);
      setUploadProgress(10);

      try {
        // Get user session
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          throw new Error("No hay sesión activa");
        }

        // Generate unique filename with user_id as folder (required by RLS policy)
        const fileExt = file.name.split('.').pop();
        const fileName = `${session.user.id}/logo_${Date.now()}.${fileExt}`;
        const filePath = fileName;

        setUploadProgress(30);

        // Upload to Supabase Storage - logos bucket
        const { error: uploadError } = await supabase.storage
          .from('logos')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: true
          });

        if (uploadError) {
          throw uploadError;
        }

        setUploadProgress(70);

        // Get public URL from logos bucket
        const { data: { publicUrl } } = supabase.storage
          .from('logos')
          .getPublicUrl(filePath);

        setUploadProgress(100);

        // Update logo URL
        onLogoChange(publicUrl);
        toast.success("Logo subido correctamente");

      } catch (error: any) {
        console.error("Error uploading logo:", error);
        toast.error(error.message || "Error al subir el logo");
      } finally {
        setIsUploading(false);
        setUploadProgress(0);
      }
    },
    [onLogoChange]
  );

  const handleRemoveLogo = () => {
    onLogoChange("");
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.webp', '.gif']
    },
    maxSize: 5 * 1024 * 1024, // 5MB
    multiple: false,
    disabled: isUploading,
  });

  // If there's a logo, show preview
  if (currentLogoUrl && !isUploading) {
    return (
      <div className={`space-y-2 ${className}`}>
        <div className="relative border rounded-lg p-3 bg-muted/30">
          <div className="flex items-center gap-3">
            <div className="w-16 h-16 bg-white rounded border flex items-center justify-center overflow-hidden">
              <img 
                src={currentLogoUrl} 
                alt="Logo actual" 
                className="max-w-full max-h-full object-contain"
                onError={(e) => {
                  e.currentTarget.src = '';
                  e.currentTarget.classList.add('hidden');
                }}
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">Logo configurado</p>
              <p className="text-xs text-muted-foreground truncate">
                {currentLogoUrl.length > 40 ? `...${currentLogoUrl.slice(-40)}` : currentLogoUrl}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                {...getRootProps()}
                className="text-xs"
              >
                <input {...getInputProps()} />
                Cambiar
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleRemoveLogo}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <div
        {...getRootProps()}
        className={`
          relative border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors
          ${isDragActive 
            ? "border-primary bg-primary/5" 
            : "border-muted-foreground/25 hover:border-primary/50"
          }
          ${isUploading ? "opacity-50 cursor-not-allowed" : ""}
        `}
      >
        <input {...getInputProps()} />
        
        <div className="flex flex-col items-center space-y-2">
          {isUploading ? (
            <>
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Upload className="w-5 h-5 text-primary animate-pulse" />
              </div>
              <div className="space-y-1 w-full max-w-xs">
                <p className="text-xs text-muted-foreground">Subiendo logo...</p>
                <Progress value={uploadProgress} className="w-full h-1" />
              </div>
            </>
          ) : (
            <>
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                <ImageIcon className="w-5 h-5 text-muted-foreground" />
              </div>
              <div className="space-y-0.5">
                <p className="text-sm font-medium">
                  {isDragActive
                    ? "Suelta el logo aquí"
                    : "Arrastra o haz clic para subir logo"
                  }
                </p>
                <p className="text-xs text-muted-foreground">
                  JPG, PNG, WebP o GIF (máx. 5MB)
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
