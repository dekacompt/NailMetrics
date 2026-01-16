import { FileImage, Upload } from 'lucide-react';
import React, { useCallback, useState } from 'react';
import { cn } from '../lib/utils';

interface ImageUploaderProps {
  onUpload: (imageSrc: string) => void;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({ onUpload }) => {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleFile = (file: File) => {
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          onUpload(e.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  }, []);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        className={cn(
          "relative border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center transition-all h-64 cursor-pointer overflow-hidden",
          isDragOver 
            ? "border-blue-500 bg-blue-500/10 scale-[1.02]" 
            : "border-neutral-700 hover:border-blue-400/50 hover:bg-neutral-800/50 bg-neutral-900"
        )}
      >
        <input
          type="file"
          accept="image/*"
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          onChange={onInputChange}
        />
        
        <div className="flex flex-col items-center text-center pointer-events-none transition-transform duration-300">
           <div className={cn(
             "w-16 h-16 rounded-full flex items-center justify-center mb-4 transition-colors",
             isDragOver ? "bg-blue-500/20 text-blue-400" : "bg-neutral-800 text-neutral-400"
           )}>
            {isDragOver ? <FileImage className="w-8 h-8" /> : <Upload className="w-8 h-8" />}
           </div>
           
           <h3 className={cn("text-lg font-medium transition-colors", isDragOver ? "text-blue-300" : "text-neutral-200")}>
             {isDragOver ? "Drop image here" : "Upload Image"}
           </h3>
           <p className="text-sm text-neutral-500 mt-2">
             Drag & drop or click to browse
           </p>
        </div>
      </div>
    </div>
  );
};
