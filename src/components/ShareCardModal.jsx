import React, { useEffect, useRef, useState } from 'react';
import { Check, Copy, Download, Image as ImageIcon, Share2 } from 'lucide-react';
import Modal from './ui/Modal';
import { renderShareCardToCanvas } from '../lib/shareCardRenderer';

export default function ShareCardModal({
  open,
  onClose,
  mode = 'picks',
  year,
  nickname,
  picks = [],
  rankingEntry = null,
  totalParticipants = 0,
}) {
  const canvasRef = useRef(null);
  const [copiedImg, setCopiedImg] = useState(false);

  useEffect(() => {
    if (!open) return;
    renderShareCardToCanvas(canvasRef.current, {
      mode,
      year,
      nickname,
      picks,
      rankingEntry,
      totalParticipants,
    });
  }, [open, mode, year, nickname, picks, rankingEntry, totalParticipants]);

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `tga-${year || 'winners'}-${mode}-${(nickname || 'card').toLowerCase().replace(/\s+/g, '-')}.png`;
    a.click();
  };

  const handleCopyImage = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (blob && navigator.clipboard && window.ClipboardItem) {
        await navigator.clipboard.write([new window.ClipboardItem({ 'image/png': blob })]);
        setCopiedImg(true);
        setTimeout(() => setCopiedImg(false), 2500);
        return;
      }
      handleDownload();
    } catch {
      handleDownload();
    }
  };

  const handleShare = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
      const file = new File([blob], `tga-${year || ''}-${mode}.png`, { type: 'image/png' });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: `TGA Winners ${year || ''}`,
          text: `Meus resultados no bolão do TGA ${year || ''}!`,
          files: [file],
        });
        return;
      }
      handleDownload();
    } catch {
      // usuário cancelou share
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      icon={ImageIcon}
      title={`Card Compartilhável (${mode === 'ranking' ? 'Resultado' : 'Palpites'})`}
      maxWidth="max-w-lg"
      bodyClassName="bg-zinc-900/40 p-4"
      footer={
        <>
          <button
            type="button"
            onClick={handleCopyImage}
            className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-900 px-3.5 py-2 text-xs font-semibold text-zinc-200 transition hover:border-amber-500/40"
          >
            {copiedImg ? (
              <Check className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            <span>{copiedImg ? 'Imagem copiada!' : 'Copiar imagem'}</span>
          </button>

          {typeof navigator !== 'undefined' && typeof navigator.share === 'function' && (
            <button
              type="button"
              onClick={handleShare}
              className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-900 px-3.5 py-2 text-xs font-semibold text-zinc-200 transition hover:border-amber-500/40"
            >
              <Share2 className="h-3.5 w-3.5" />
              <span>Compartilhar</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleDownload}
            className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-zinc-950 transition hover:bg-amber-400"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Baixar PNG</span>
          </button>
        </>
      }
    >
      <canvas
        ref={canvasRef}
        className="mx-auto w-full max-w-[360px] rounded-xl border border-zinc-800 shadow-2xl"
      />
    </Modal>
  );
}
