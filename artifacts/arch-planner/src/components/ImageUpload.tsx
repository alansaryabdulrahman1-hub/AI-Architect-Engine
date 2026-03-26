import { useRef, useCallback } from "react";
import { ImagePlus, X } from "lucide-react";

interface ImageUploadProps {
  images: string[];
  onImagesChange: (images: string[]) => void;
  maxImages?: number;
  compact?: boolean;
}

export function ImageUpload({ images, onImagesChange, maxImages = 5, compact = false }: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files) return;
    const remaining = maxImages - images.length;
    if (remaining <= 0) return;

    const filesToProcess = Array.from(files)
      .filter((f) => f.type.startsWith("image/") && f.size <= 20 * 1024 * 1024)
      .slice(0, remaining);

    const results = await Promise.all(
      filesToProcess.map(
        (file) =>
          new Promise<string | null>((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve((e.target?.result as string) ?? null);
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(file);
          }),
      ),
    );

    const newUrls = results.filter((r): r is string => r !== null);
    if (newUrls.length > 0) {
      onImagesChange([...images, ...newUrls]);
    }
  }, [images, onImagesChange, maxImages]);

  const removeImage = useCallback((index: number) => {
    onImagesChange(images.filter((_, i) => i !== index));
  }, [images, onImagesChange]);

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        {images.length > 0 && (
          <div className="flex items-center gap-1.5">
            {images.map((img, i) => (
              <div key={i} className="relative group w-9 h-9 rounded-lg overflow-hidden border border-zinc-700">
                <img src={img} alt="" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeImage(i)}
                  className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                >
                  <X className="w-3.5 h-3.5 text-white" />
                </button>
              </div>
            ))}
          </div>
        )}
        {images.length < maxImages && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="p-2 text-zinc-400 hover:text-teal-400 hover:bg-zinc-800 rounded-xl transition-colors"
            title="إرفاق صورة"
          >
            <ImagePlus className="w-5 h-5" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      
      <div className="flex flex-wrap gap-3">
        {images.map((img, i) => (
          <div key={i} className="relative group w-24 h-24 rounded-xl overflow-hidden border border-zinc-700 bg-zinc-900">
            <img src={img} alt="" className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => removeImage(i)}
              className="absolute top-1 right-1 w-6 h-6 bg-black/70 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="w-3.5 h-3.5 text-white" />
            </button>
          </div>
        ))}
        
        {images.length < maxImages && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="w-24 h-24 rounded-xl border-2 border-dashed border-zinc-700 hover:border-teal-500/50 flex flex-col items-center justify-center gap-2 text-zinc-500 hover:text-teal-400 transition-colors bg-zinc-900/30"
          >
            <ImagePlus className="w-6 h-6" />
            <span className="text-xs">إضافة صورة</span>
          </button>
        )}
      </div>
      
      {images.length > 0 && (
        <p className="text-xs text-zinc-500 mt-2">
          {images.length}/{maxImages} صور مرفقة — رسومات، صور موقع، أو مراجع تصميمية
        </p>
      )}
    </div>
  );
}
