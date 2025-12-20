import { useRef, useState } from "react";
import { useTranslation } from 'react-i18next';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Trash2, Type, Image as ImageIcon, Upload, Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, ChevronDown, Info, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { generateImageFromText, generateImageFromReference, type ImageQuality } from "@/lib/imageGen/imagenService";
import Block from '@uiw/react-color-block';
import type { AnnotationRegion, AnnotationType, ArrowDirection, FigureData } from "./types";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { getArrowComponent } from "./ArrowSvgs";

interface AnnotationSettingsPanelProps {
  annotation: AnnotationRegion;
  onContentChange: (content: string) => void;
  onTypeChange: (type: AnnotationType) => void;
  onStyleChange: (style: Partial<AnnotationRegion['style']>) => void;
  onFigureDataChange?: (figureData: FigureData) => void;
  onDelete: () => void;
}

const FONT_FAMILIES = [
  { value: 'system-ui, -apple-system, sans-serif', label: 'Classic' },
  { value: 'Georgia, serif', label: 'Editor' },
  { value: 'Impact, Arial Black, sans-serif', label: 'Strong' },
  { value: 'Courier New, monospace', label: 'Typewriter' },
  { value: 'Brush Script MT, cursive', label: 'Deco' },
  { value: 'Arial, sans-serif', label: 'Simple' },
  { value: 'Verdana, sans-serif', label: 'Modern' },
  { value: 'Trebuchet MS, sans-serif', label: 'Clean' },
];

const FONT_SIZES = [12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 48, 56, 64, 72, 80, 96, 128];

export function AnnotationSettingsPanel({
  annotation,
  onContentChange,
  onTypeChange,
  onStyleChange,
  onFigureDataChange,
  onDelete,
}: AnnotationSettingsPanelProps) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // AI 图像生成状态
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiQuality, setAiQuality] = useState<ImageQuality>('efficiency');
  const [isGenerating, setIsGenerating] = useState(false);
  const [imageApiKey, setImageApiKey] = useState(() => {
    // 从 localStorage 加载已保存的 API Key
    return localStorage.getItem('openscreen_gemini_api_key') || '';
  });
  
  // AI 图像生成处理
  const handleAiGenerate = async () => {
    if (!aiPrompt.trim()) {
      toast.error(t('imageGen.noPrompt'));
      return;
    }
    
    if (!imageApiKey.trim()) {
      toast.error('请先输入 API Key');
      return;
    }
    
    setIsGenerating(true);
    
    try {
      let result;
      
      // 如果已有图片，使用图生图
      if (annotation.content && annotation.content.startsWith('data:image')) {
        result = await generateImageFromReference(aiPrompt, annotation.content, aiQuality, imageApiKey);
      } else {
        // 否则使用文生图
        result = await generateImageFromText(aiPrompt, aiQuality, imageApiKey);
      }
      
      if (result.success && result.imageBase64) {
        onContentChange(result.imageBase64);
        toast.success(t('imageGen.success'));
        setAiPrompt('');
      } else {
        toast.error(result.error || t('imageGen.failed'));
      }
    } catch (error) {
      toast.error(t('imageGen.failed'));
    } finally {
      setIsGenerating(false);
    }
  };
  
  const colorPalette = [
    '#FF0000', // Red
    '#FFD700', // Yellow/Gold
    '#00FF00', // Green
    '#FFFFFF', // White
    '#0000FF', // Blue
    '#FF6B00', // Orange
    '#9B59B6', // Purple
    '#E91E63', // Pink
    '#00BCD4', // Cyan
    '#FF5722', // Deep Orange
    '#8BC34A', // Light Green
    '#FFC107', // Amber
    '#34B27B', // Brand Green
    '#000000', // Black
    '#607D8B', // Blue Grey
    '#795548', // Brown
  ];



  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    
    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast.error(t('editor.invalidFileType'), {
        description: t('editor.pleaseUploadImage'),
      });
      event.target.value = '';
      return;
    }

    const reader = new FileReader();

    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (dataUrl) {
        onContentChange(dataUrl);
        toast.success(t('editor.imageUploadSuccess'));
      }
    };

    reader.onerror = () => {
      toast.error(t('editor.failedToUpload'), {
        description: t('editor.errorReadingFile'),
      });
    };

    reader.readAsDataURL(file);
    event.target.value = '';
  };

  return (
    <div className="w-full bg-[#09090b] border border-white/5 rounded-2xl p-4 flex flex-col shadow-xl min-h-full">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-medium text-slate-200">{t('editor.annotationSettings')}</span>
          <span className="text-[10px] uppercase tracking-wider font-medium text-[#34B27B] bg-[#34B27B]/10 px-2 py-1 rounded-full">
            {t('common.active')}
          </span>
        </div>
        
        {/* Type Selector */}
        <Tabs value={annotation.type} onValueChange={(value) => onTypeChange(value as AnnotationType)} className="mb-6">
          <TabsList className="mb-4 bg-white/5 border border-white/5 p-1 w-full grid grid-cols-3 h-auto rounded-xl">
            <TabsTrigger value="text" className="data-[state=active]:bg-[#34B27B] data-[state=active]:text-white text-slate-400 py-2 rounded-lg transition-all gap-2">
              <Type className="w-4 h-4" />
              {t('editor.text')}
            </TabsTrigger>
            <TabsTrigger value="image" className="data-[state=active]:bg-[#34B27B] data-[state=active]:text-white text-slate-400 py-2 rounded-lg transition-all gap-2">
              <ImageIcon className="w-4 h-4" />
              {t('editor.image')}
            </TabsTrigger>
            <TabsTrigger value="figure" className="data-[state=active]:bg-[#34B27B] data-[state=active]:text-white text-slate-400 py-2 rounded-lg transition-all gap-2">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 12h16m0 0l-6-6m6 6l-6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {t('editor.arrow')}
            </TabsTrigger>
          </TabsList>

          {/* Text Content */}
          <TabsContent value="text" className="mt-0 space-y-4">
            <div>
              <label className="text-xs font-medium text-slate-200 mb-2 block">{t('editor.textContent')}</label>
              <textarea
                value={annotation.textContent || annotation.content}
                onChange={(e) => onContentChange(e.target.value)}
                placeholder={t('editor.enterText')}
                rows={5}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-slate-200 text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#34B27B] focus:border-transparent resize-none"
              />
            </div>

            {/* Styling Controls */}
            <div className="space-y-4">
              {/* Font Family & Size */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium text-slate-200 mb-2 block">{t('editor.fontStyle')}</label>
                  <Select 
                    value={annotation.style.fontFamily} 
                    onValueChange={(value) => onStyleChange({ fontFamily: value })}
                  >
                    <SelectTrigger className="w-full bg-white/5 border-white/10 text-slate-200 h-9 text-xs">
                      <SelectValue placeholder={t('editor.fontStyle')} />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1a1a1c] border-white/10 text-slate-200">
                      {FONT_FAMILIES.map((font) => (
                        <SelectItem key={font.value} value={font.value} style={{ fontFamily: font.value }}>
                          {font.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-200 mb-2 block">{t('editor.size')}</label>
                  <Select 
                    value={annotation.style.fontSize.toString()} 
                    onValueChange={(value) => onStyleChange({ fontSize: parseInt(value) })}
                  >
                    <SelectTrigger className="w-full bg-white/5 border-white/10 text-slate-200 h-9 text-xs">
                      <SelectValue placeholder={t('editor.size')} />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1a1a1c] border-white/10 text-slate-200 max-h-[200px]">
                      {FONT_SIZES.map((size) => (
                        <SelectItem key={size} value={size.toString()}>
                          {size}px
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Formatting Toggles */}
              <div className="flex items-center justify-between gap-2">
                <ToggleGroup type="multiple" className="justify-start bg-white/5 p-1 rounded-lg border border-white/5">
                  <ToggleGroupItem 
                    value="bold" 
                    aria-label="Toggle bold"
                    data-state={annotation.style.fontWeight === 'bold' ? 'on' : 'off'}
                    onClick={() => onStyleChange({ fontWeight: annotation.style.fontWeight === 'bold' ? 'normal' : 'bold' })}
                    className="h-8 w-8 data-[state=on]:bg-[#34B27B] data-[state=on]:text-white text-slate-400 hover:bg-white/5 hover:text-slate-200"
                  >
                    <Bold className="h-4 w-4" />
                  </ToggleGroupItem>
                  <ToggleGroupItem 
                    value="italic" 
                    aria-label="Toggle italic"
                    data-state={annotation.style.fontStyle === 'italic' ? 'on' : 'off'}
                    onClick={() => onStyleChange({ fontStyle: annotation.style.fontStyle === 'italic' ? 'normal' : 'italic' })}
                    className="h-8 w-8 data-[state=on]:bg-[#34B27B] data-[state=on]:text-white text-slate-400 hover:bg-white/5 hover:text-slate-200"
                  >
                    <Italic className="h-4 w-4" />
                  </ToggleGroupItem>
                  <ToggleGroupItem 
                    value="underline" 
                    aria-label="Toggle underline"
                    data-state={annotation.style.textDecoration === 'underline' ? 'on' : 'off'}
                    onClick={() => onStyleChange({ textDecoration: annotation.style.textDecoration === 'underline' ? 'none' : 'underline' })}
                    className="h-8 w-8 data-[state=on]:bg-[#34B27B] data-[state=on]:text-white text-slate-400 hover:bg-white/5 hover:text-slate-200"
                  >
                    <Underline className="h-4 w-4" />
                  </ToggleGroupItem>
                </ToggleGroup>

                <ToggleGroup type="single" value={annotation.style.textAlign} className="justify-start bg-white/5 p-1 rounded-lg border border-white/5">
                  <ToggleGroupItem 
                    value="left" 
                    aria-label="Align left"
                    onClick={() => onStyleChange({ textAlign: 'left' })}
                    className="h-8 w-8 data-[state=on]:bg-[#34B27B] data-[state=on]:text-white text-slate-400 hover:bg-white/5 hover:text-slate-200"
                  >
                    <AlignLeft className="h-4 w-4" />
                  </ToggleGroupItem>
                  <ToggleGroupItem 
                    value="center" 
                    aria-label="Align center"
                    onClick={() => onStyleChange({ textAlign: 'center' })}
                    className="h-8 w-8 data-[state=on]:bg-[#34B27B] data-[state=on]:text-white text-slate-400 hover:bg-white/5 hover:text-slate-200"
                  >
                    <AlignCenter className="h-4 w-4" />
                  </ToggleGroupItem>
                  <ToggleGroupItem 
                    value="right" 
                    aria-label="Align right"
                    onClick={() => onStyleChange({ textAlign: 'right' })}
                    className="h-8 w-8 data-[state=on]:bg-[#34B27B] data-[state=on]:text-white text-slate-400 hover:bg-white/5 hover:text-slate-200"
                  >
                    <AlignRight className="h-4 w-4" />
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>

              {/* Colors */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-slate-200 mb-2 block">{t('editor.textColor')}</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button 
                        variant="outline" 
                        className="w-full h-9 justify-start gap-2 bg-white/5 border-white/10 hover:bg-white/10 px-2"
                      >
                        <div 
                          className="w-4 h-4 rounded-full border border-white/20" 
                          style={{ backgroundColor: annotation.style.color }}
                        />
                        <span className="text-xs text-slate-300 truncate flex-1 text-left">
                          {annotation.style.color}
                        </span>
                        <ChevronDown className="h-3 w-3 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[260px] p-3 bg-[#1a1a1c] border border-white/10 rounded-xl shadow-xl">
                      <Block
                        color={annotation.style.color}
                        colors={colorPalette}
                        onChange={(color) => {
                          onStyleChange({ color: color.hex });
                        }}
                        style={{
                          borderRadius: '8px',
                        }}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-200 mb-2 block">{t('editor.background')}</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button 
                        variant="outline" 
                        className="w-full h-9 justify-start gap-2 bg-white/5 border-white/10 hover:bg-white/10 px-2"
                      >
                        <div 
                          className="w-4 h-4 rounded-full border border-white/20 relative overflow-hidden" 
                        >
                          <div className="absolute inset-0 checkerboard-bg opacity-50" />
                          <div 
                            className="absolute inset-0"
                            style={{ backgroundColor: annotation.style.backgroundColor }}
                          />
                        </div>
                        <span className="text-xs text-slate-300 truncate flex-1 text-left">
                          {annotation.style.backgroundColor === 'transparent' ? t('editor.none') : t('editor.color')}
                        </span>
                        <ChevronDown className="h-3 w-3 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[260px] p-3 bg-[#1a1a1c] border border-white/10 rounded-xl shadow-xl">
                      <Block
                        color={annotation.style.backgroundColor === 'transparent' ? '#000000' : annotation.style.backgroundColor}
                        colors={colorPalette}
                        onChange={(color) => {
                          onStyleChange({ backgroundColor: color.hex });
                        }}
                        style={{
                          borderRadius: '8px',
                        }}
                      />
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="w-full mt-2 text-xs h-7 hover:bg-white/5 text-slate-400"
                        onClick={() => {
                          onStyleChange({ backgroundColor: 'transparent' });
                        }}
                      >
                        {t('editor.clearBackground')}
                      </Button>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </div>


          </TabsContent>

          {/* Image Upload */}
          <TabsContent value="image" className="mt-0 space-y-4">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageUpload}
              accept=".jpg,.jpeg,.png,.gif,.webp,image/*"
              className="hidden"
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              variant="outline"
              className="w-full gap-2 bg-white/5 text-slate-200 border-white/10 hover:bg-[#34B27B] hover:text-white hover:border-[#34B27B] transition-all py-8"
            >
              <Upload className="w-5 h-5" />
              {t('editor.uploadImage')}
            </Button>

            {annotation.content && annotation.content.startsWith('data:image') && (
              <div className="rounded-lg border border-white/10 overflow-hidden bg-white/5 p-2">
                <img
                  src={annotation.content}
                  alt="Uploaded annotation"
                  className="w-full h-auto rounded-md"
                />
              </div>
            )}

            <p className="text-xs text-slate-500 text-center leading-relaxed">
              {t('editor.supportedFormats')}
            </p>
            
            {/* AI 图像生成区域 */}
            <div className="mt-4 pt-4 border-t border-white/10">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-[#34B27B]" />
                <span className="text-xs font-medium text-slate-200">{t('imageGen.title')}</span>
              </div>
              
              {/* API Key 输入 */}
              <div className="mb-3">
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={imageApiKey}
                    onChange={(e) => setImageApiKey(e.target.value)}
                    placeholder="输入 Gemini API Key (AIzaSy...)"
                    className="flex-1 h-8 text-xs bg-white/5 border border-white/10 rounded-lg px-3 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-[#34B27B]"
                  />
                  <Button
                    onClick={() => {
                      if (imageApiKey.trim()) {
                        localStorage.setItem('openscreen_gemini_api_key', imageApiKey.trim());
                        toast.success('API Key 已保存');
                      }
                    }}
                    disabled={!imageApiKey.trim()}
                    size="sm"
                    className="h-8 px-3 bg-[#34B27B] hover:bg-[#2da36c] text-white text-xs disabled:opacity-50"
                  >
                    保存
                  </Button>
                </div>
              </div>
              
              {/* 提示词输入 */}
              <textarea
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder={annotation.content && annotation.content.startsWith('data:image') 
                  ? t('imageGen.promptPlaceholderRef') 
                  : t('imageGen.promptPlaceholder')}
                rows={3}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-slate-200 text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#34B27B] focus:border-transparent resize-none mb-3"
              />
              
              {/* 质量选择 */}
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs text-slate-400">{t('imageGen.quality')}:</span>
                <div className="flex gap-1 flex-1">
                  <button
                    onClick={() => setAiQuality('efficiency')}
                    className={cn(
                      "flex-1 px-3 py-1.5 text-xs rounded-lg transition-all",
                      aiQuality === 'efficiency'
                        ? "bg-[#34B27B] text-white"
                        : "bg-white/5 text-slate-400 hover:bg-white/10"
                    )}
                  >
                    {t('imageGen.efficiency')}
                  </button>
                  <button
                    onClick={() => setAiQuality('quality')}
                    className={cn(
                      "flex-1 px-3 py-1.5 text-xs rounded-lg transition-all",
                      aiQuality === 'quality'
                        ? "bg-[#34B27B] text-white"
                        : "bg-white/5 text-slate-400 hover:bg-white/10"
                    )}
                  >
                    {t('imageGen.qualityOption')}
                  </button>
                </div>
              </div>
              
              {/* 生成按钮 */}
              <Button
                onClick={handleAiGenerate}
                disabled={isGenerating || !aiPrompt.trim() || !imageApiKey.trim()}
                className="w-full gap-2 bg-[#34B27B] hover:bg-[#2da36c] text-white transition-all disabled:opacity-50"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t('imageGen.generating')}
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    {annotation.content && annotation.content.startsWith('data:image')
                      ? t('imageGen.generateFromRef')
                      : t('imageGen.generate')}
                  </>
                )}
              </Button>
              
              {/* 提示信息 */}
              <p className="text-[10px] text-slate-500 text-center mt-2 leading-relaxed">
                {annotation.content && annotation.content.startsWith('data:image')
                  ? t('imageGen.refHint')
                  : t('imageGen.hint')}
              </p>
            </div>
          </TabsContent>
          <TabsContent value="figure" className="mt-0 space-y-4">
            <div>
              <label className="text-xs font-medium text-slate-200 mb-3 block">{t('editor.arrowDirection')}</label>
              <div className="grid grid-cols-4 gap-2">
                {([
                  'up', 'down', 'left', 'right',
                  'up-right', 'up-left', 'down-right', 'down-left',
                ] as ArrowDirection[]).map((direction) => {
                  const ArrowComponent = getArrowComponent(direction);
                  return (
                    <button
                      key={direction}
                      onClick={() => {
                        const newFigureData: FigureData = {
                          ...annotation.figureData!,
                          arrowDirection: direction,
                        };
                        onFigureDataChange?.(newFigureData);
                      }}
                      className={cn(
                        "h-16 rounded-lg border flex items-center justify-center transition-all p-2",
                        annotation.figureData?.arrowDirection === direction
                          ? "bg-[#34B27B] border-[#34B27B]"
                          : "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20"
                      )}
                    >
                      <ArrowComponent
                        color={annotation.figureData?.arrowDirection === direction ? "#ffffff" : "#94a3b8"}
                        strokeWidth={3}
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-200 mb-2 block">
                {t('editor.strokeWidth')}: {annotation.figureData?.strokeWidth || 4}px
              </label>
              <Slider
                value={[annotation.figureData?.strokeWidth || 4]}
                onValueChange={([value]) => {
                  const newFigureData: FigureData = {
                    ...annotation.figureData!,
                    strokeWidth: value,
                  };
                  onFigureDataChange?.(newFigureData);
                }}
                min={1}
                max={6}
                step={1}
                className="w-full"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-200 mb-2 block">{t('editor.arrowColor')}</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button 
                    variant="outline" 
                    className="w-full h-10 justify-start gap-2 bg-white/5 border-white/10 hover:bg-white/10"
                  >
                    <div 
                      className="w-5 h-5 rounded-full border border-white/20" 
                      style={{ backgroundColor: annotation.figureData?.color || '#34B27B' }}
                    />
                    <span className="text-xs text-slate-300 truncate flex-1 text-left">
                      {annotation.figureData?.color || '#34B27B'}
                    </span>
                    <ChevronDown className="h-3 w-3 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[260px] p-3 bg-[#1a1a1c] border border-white/10 rounded-xl shadow-xl">
                  <Block
                    color={annotation.figureData?.color || '#34B27B'}
                    colors={colorPalette}
                    onChange={(color) => {
                      const newFigureData: FigureData = {
                        ...annotation.figureData!,
                        color: color.hex,
                      };
                      onFigureDataChange?.(newFigureData);
                    }}
                    style={{
                      borderRadius: '8px',
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </TabsContent>
        </Tabs>

        <Button
          onClick={onDelete}
          variant="destructive"
          size="sm"
          className="w-full gap-2 bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 hover:border-red-500/30 transition-all mt-4"
        >
          <Trash2 className="w-4 h-4" />
          {t('editor.deleteAnnotation')}
        </Button>

        <div className="mt-6 p-3 bg-white/5 rounded-lg border border-white/5">
          <div className="flex items-center gap-2 mb-2 text-slate-300">
            <Info className="w-3.5 h-3.5" />
            <span className="text-xs font-medium">{t('editor.shortcutsAndTips')}</span>
          </div>
          <ul className="text-[10px] text-slate-400 space-y-1.5 list-disc pl-3 leading-relaxed">
            <li>{t('editor.tipMovePlayhead')}</li>
            <li>{t('editor.tipTabCycle')}</li>
            <li>{t('editor.tipShiftTabCycle')}</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
