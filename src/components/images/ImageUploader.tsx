import React, { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, X, Image as ImageIcon } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useImageManagement } from "@/hooks/useImageManagement";
import { useImageCategories } from "@/hooks/useImageCategories";
import { useImageSubcategories } from "@/hooks/useImageSubcategories";
import { useImageCategoryAssignments } from "@/hooks/useImageCategoryAssignments";

interface ImageUploaderProps {
  onUploadComplete?: (imageId: string) => void;
  multiple?: boolean;
  className?: string;
  defaultCategoryId?: string;
  defaultSubcategoryId?: string;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({
  onUploadComplete,
  multiple = false,
  className = "",
  defaultCategoryId,
  defaultSubcategoryId,
}) => {
  const { uploadImageAsync, isUploading, uploadProgress } = useImageManagement();
  const { categories } = useImageCategories();
  const { subcategories } = useImageSubcategories();
  const { assignCategory } = useImageCategoryAssignments();

  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(defaultCategoryId || "");
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<string>(defaultSubcategoryId || "");

  // Filter subcategories by selected category
  const filteredSubcategories = subcategories.filter(
    (sub) => sub.category_id === selectedCategoryId
  );

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const filesToUpload = multiple ? acceptedFiles : acceptedFiles.slice(0, 1);

      // Subida secuencial (EasyQuote no soporta bien “varias de golpe”)
      for (const file of filesToUpload) {
        await uploadImageAsync(
          { file },
          {
            onSuccess: (data) => {
              // Assign category if selected
              if (selectedCategoryId && data?.id) {
                assignCategory({
                  imageId: data.id,
                  categoryId: selectedCategoryId,
                  subcategoryId: selectedSubcategoryId || null,
                });
              }
              onUploadComplete?.(data.id);
            },
          }
        );
      }
    },
    [uploadImageAsync, multiple, onUploadComplete, selectedCategoryId, selectedSubcategoryId, assignCategory]
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

  // Reset subcategory when category changes
  const handleCategoryChange = (value: string) => {
    setSelectedCategoryId(value);
    setSelectedSubcategoryId("");
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Category and Subcategory selectors */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="upload-category">Categoría</Label>
          <Select value={selectedCategoryId} onValueChange={handleCategoryChange}>
            <SelectTrigger id="upload-category">
              <SelectValue placeholder="Seleccionar categoría" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: cat.color }} 
                    />
                    {cat.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="upload-subcategory">Subcategoría</Label>
          <Select 
            value={selectedSubcategoryId} 
            onValueChange={setSelectedSubcategoryId}
            disabled={!selectedCategoryId || filteredSubcategories.length === 0}
          >
            <SelectTrigger id="upload-subcategory">
              <SelectValue placeholder={filteredSubcategories.length === 0 ? "Sin subcategorías" : "Seleccionar"} />
            </SelectTrigger>
            <SelectContent>
              {filteredSubcategories.map((sub) => (
                <SelectItem key={sub.id} value={sub.id}>
                  {sub.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Dropzone */}
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