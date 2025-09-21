import React, { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, X, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useImageManagement } from "@/hooks/useImageManagement";

interface ImageUploaderProps {
  onUploadComplete?: (imageId: string) => void;
  multiple?: boolean;
  className?: string;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({
  onUploadComplete,
  multiple = false,
  className = "",
}) => {
  const { uploadImage, isUploading, uploadProgress } = useImageManagement();

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const filesToUpload = multiple ? acceptedFiles : acceptedFiles.slice(0, 1);
      
      filesToUpload.forEach((file) => {
        uploadImage(
          { file },
          {
            onSuccess: (data) => {
              onUploadComplete?.(data.id);
            },
          }
        );
      });
    },
    [uploadImage, multiple, onUploadComplete]
  );

  const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.webp', '.gif']
    },
    maxSize: 10 * 1024 * 1024, // 10MB
    multiple,
    disabled: isUploading,
  });

  return (
    <div className={`space-y-4 ${className}`}>
      <div
        {...getRootProps()}
        className={`
          relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
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
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Upload className="w-6 h-6 text-primary animate-pulse" />
            </div>
          ) : (
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <ImageIcon className="w-6 h-6 text-muted-foreground" />
            </div>
          )}
          
          {isUploading ? (
            <div className="space-y-2 w-full max-w-xs">
              <p className="text-sm text-muted-foreground">Subiendo imagen...</p>
              <Progress value={uploadProgress} className="w-full" />
              <p className="text-xs text-muted-foreground">{uploadProgress}%</p>
            </div>
          ) : (
            <div className="space-y-1">
              <p className="text-sm font-medium">
                {isDragActive
                  ? "Suelta las imágenes aquí"
                  : "Arrastra imágenes aquí o haz clic para seleccionar"
                }
              </p>
              <p className="text-xs text-muted-foreground">
                JPG, PNG, WebP o GIF (máx. 10MB)
              </p>
            </div>
          )}
        </div>
      </div>

      {fileRejections.length > 0 && (
        <div className="space-y-2">
          {fileRejections.map(({ file, errors }) => (
            <div key={file.name} className="flex items-center space-x-2 text-sm text-destructive">
              <X className="w-4 h-4" />
              <span>{file.name}: {errors[0]?.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};