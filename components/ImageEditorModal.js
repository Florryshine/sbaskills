'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { createBrowserClient } from '@/lib/supabase';

const PRESETS = {
  'Instagram Square (1080x1080)': { width: 1080, height: 1080 },
  'Blog / Notes Cover (1200x675)': { width: 1200, height: 675 },
  'Story / Reel (1080x1920)': { width: 1080, height: 1920 },
};

const FONTS = ['Arial', 'Georgia', 'Verdana', 'Times New Roman', 'Trebuchet MS'];

// Breaks `text` into lines that each fit within `maxWidth` px, using the
// canvas context's currently-set font to measure. Also honors manual
// newlines the user types (\n) as forced line breaks.
function wrapText(ctx, text, maxWidth) {
  const paragraphs = text.split('\n');
  const lines = [];
  for (const para of paragraphs) {
    const words = para.split(' ');
    let current = '';
    for (const word of words) {
      const test = current ? `${current} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = test;
      }
    }
    lines.push(current);
  }
  return lines;
}

export default function ImageEditorModal({ image, knowledgeAssetId, onClose, onSaved }) {
  const canvasRef = useRef(null);
  const [presetName, setPresetName] = useState('Blog / Notes Cover (1200x675)');
  const [text, setText] = useState('');
  const [color, setColor] = useState('#FFFFFF');
  const [font, setFont] = useState('Arial');
  const [fontSize, setFontSize] = useState(48);
  const [textPos, setTextPos] = useState({ x: 0.08, y: 0.75 }); // fractional position, draggable (top-left of text block)
  const [textWidthPct, setTextWidthPct] = useState(0.84); // how wide the text block is allowed to be, as % of canvas width
  const [showBrand, setShowBrand] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dragging, setDragging] = useState(false);
  const imgElRef = useRef(null);

  const preset = PRESETS[presetName];

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imgElRef.current) return;
    const ctx = canvas.getContext('2d');
    const { width: W, height: H } = preset;
    canvas.width = W;
    canvas.height = H;

    // Cover-fit the source image
    const img = imgElRef.current;
    const scale = Math.max(W / img.width, H / img.height);
    const sw = W / scale, sh = H / scale;
    const sx = (img.width - sw) / 2, sy = (img.height - sh) / 2;
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, W, H);

    // Dark gradient so text stays readable
    const gradient = ctx.createLinearGradient(0, H * 0.5, 0, H);
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(1, 'rgba(0,0,0,0.6)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, H * 0.5, W, H * 0.5);

    // User text — wrapped across multiple lines instead of one long line
    if (text) {
      ctx.fillStyle = color;
      ctx.font = `bold ${fontSize}px ${font}`;
      ctx.textBaseline = 'top';
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 8;

      const maxWidth = W * textWidthPct;
      const lines = wrapText(ctx, text, maxWidth);
      const lineHeight = fontSize * 1.25;

      lines.forEach((line, i) => {
        ctx.fillText(line, W * textPos.x, H * textPos.y + i * lineHeight);
      });

      ctx.shadowBlur = 0;
    }

    // Brand watermark
    if (showBrand) {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = `bold 16px Arial`;
      ctx.textBaseline = 'bottom';
      ctx.fillText('Shiney Brain Academy', 20, H - 16);
    }
  }, [preset, text, color, font, fontSize, textPos, textWidthPct, showBrand]);

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => { imgElRef.current = img; draw(); };
    img.src = image.url;
  }, [image.url]); // eslint-disable-line

  useEffect(() => { draw(); }, [draw]);

  // Drag the text box around by clicking on the canvas
  const handlePointerDown = () => setDragging(true);
  const handlePointerUp = () => setDragging(false);
  const handlePointerMove = (e) => {
    if (!dragging) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const clientX = e.clientX ?? e.touches?.[0]?.clientX;
    const clientY = e.clientY ?? e.touches?.[0]?.clientY;
    const x = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 0.95);
    const y = Math.min(Math.max((clientY - rect.top) / rect.height, 0), 0.95);
    setTextPos({ x, y });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const supabase = createBrowserClient();
      const blob = await new Promise((resolve) => canvasRef.current.toBlob(resolve, 'image/jpeg', 0.9));
      const path = `${knowledgeAssetId}/edited-${Date.now()}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from('asset-images')
        .upload(path, blob, { contentType: 'image/jpeg', upsert: true });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('asset-images').getPublicUrl(path);

      const { error: insertError } = await supabase.from('asset_images').insert({
        knowledge_asset_id: knowledgeAssetId,
        source: 'edited',
        url: urlData.publicUrl,
        parent_image_id: image.id,
        purpose: 'general',
        hosted: true,
      });
      if (insertError) throw insertError;

      onSaved();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-4 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-3">
          <h2 className="font-bold text-lg">Edit Image</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800">✕</button>
        </div>

        <canvas
          ref={canvasRef}
          className="w-full rounded-xl border cursor-move touch-none"
          onMouseDown={handlePointerDown}
          onMouseUp={handlePointerUp}
          onMouseLeave={handlePointerUp}
          onMouseMove={handlePointerMove}
          onTouchStart={handlePointerDown}
          onTouchEnd={handlePointerUp}
          onTouchMove={handlePointerMove}
        />
        <p className="text-xs text-gray-400 mt-1">Drag on the image to reposition the text block. Press Enter in the text box for a manual line break.</p>

        <div className="grid grid-cols-2 gap-3 mt-4">
          <select value={presetName} onChange={(e) => setPresetName(e.target.value)} className="border rounded-lg p-2 col-span-2">
            {Object.keys(PRESETS).map((name) => <option key={name} value={name}>{name}</option>)}
          </select>

          <textarea
            placeholder="Text to overlay (e.g. a hook or title). Press Enter for a manual line break."
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            className="border rounded-lg p-2 col-span-2 resize-y"
          />

          <select value={font} onChange={(e) => setFont(e.target.value)} className="border rounded-lg p-2">
            {FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>

          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="border rounded-lg p-2 h-10" />

          <label className="col-span-2 text-sm text-gray-600">
            Font size: {fontSize}px
            <input type="range" min="20" max="90" value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))} className="w-full" />
          </label>

          <label className="col-span-2 text-sm text-gray-600">
            Text block width: {Math.round(textWidthPct * 100)}% of image
            <input type="range" min="30" max="95" value={Math.round(textWidthPct * 100)} onChange={(e) => setTextWidthPct(Number(e.target.value) / 100)} className="w-full" />
          </label>

          <label className="col-span-2 flex items-center gap-2 text-sm text-gray-600">
            <input type="checkbox" checked={showBrand} onChange={(e) => setShowBrand(e.target.checked)} />
            Add "Shiney Brain Academy" watermark
          </label>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-100">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="px-4 py-2 rounded-xl text-sm font-bold bg-brand-blue text-white hover:opacity-90 disabled:opacity-50">
            {saving ? 'Saving...' : 'Save as New Image'}
          </button>
        </div>
      </div>
    </div>
  );
}
