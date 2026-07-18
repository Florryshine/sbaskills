'use client';
import React from "react";
import { 
  Heart, MessageCircle, Repeat2, Send, Share, ThumbsUp, MoreHorizontal, Bookmark, Eye, BookmarkIcon,
  CheckCircle2, Users, Pin, ArrowRight, ExternalLink, MessageSquare
} from "lucide-react";
import { SocialPlatform } from "../types";

interface PostPreviewerProps {
  post: any;
}

export function PostPreviewer({ post }: PostPreviewerProps) {
  const { platform, content, mediaUrls, imagePrompt, callToAction, altText } = post;
  const imageAttach = mediaUrls && mediaUrls.length > 0 ? mediaUrls[0] : null;

  switch (platform) {
    case "X":
    case "Threads":
      return (
        <div className="bg-slate-950 rounded-2xl border border-slate-800 p-5 space-y-4 shadow-xl">
          {/* Header */}
          <div className="flex justify-between items-start">
            <div className="flex gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center font-bold text-slate-200">
                SB
              </div>
              <div>
                <div className="flex items-center gap-1">
                  <span className="font-bold text-sm text-slate-100">Shiney Brain Academy</span>
                  <span className="text-[11px] text-blue-400 bg-blue-500/10 px-1 rounded">✓</span>
                </div>
                <span className="text-xs text-slate-400 font-mono">@ShineyBrain • 1m</span>
              </div>
            </div>
            <MoreHorizontal size={16} className="text-slate-500" />
          </div>

          {/* Text Content */}
          <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap font-sans">{content}</p>

          {/* Attachment */}
          {imageAttach && (
            <div className="rounded-xl overflow-hidden border border-slate-800 bg-slate-900/60 relative group">
              <img src={imageAttach} alt={altText || "Social Graphic"} className="w-full object-cover max-h-72" />
              <div className="absolute top-2 left-2 bg-black/75 px-2.5 py-1 rounded-md text-[9px] font-mono text-indigo-400">
                AI Prompt Synchronized
              </div>
            </div>
          )}

          {/* Call to Action Bar */}
          {callToAction && (
            <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-xl flex items-center justify-between text-xs hover:bg-slate-900 transition-all">
              <div className="flex items-center gap-2 text-slate-200">
                <CheckCircle2 size={14} className="text-indigo-400 shrink-0" />
                <span className="font-medium truncate">{callToAction}</span>
              </div>
              <ArrowRight size={14} className="text-indigo-400 shrink-0" />
            </div>
          )}

          {/* Engagement actions typical to X */}
          <div className="flex justify-between items-center pt-2 text-slate-500 text-xs font-mono">
            <span className="flex items-center gap-1.5 hover:text-blue-400 cursor-pointer"><MessageCircle size={15} /> 12</span>
            <span className="flex items-center gap-1.5 hover:text-green-400 cursor-pointer"><Repeat2 size={15} /> 8</span>
            <span className="flex items-center gap-1.5 hover:text-rose-400 cursor-pointer"><Heart size={15} /> 48</span>
            <span className="flex items-center gap-1.5 hover:text-blue-400 cursor-pointer"><Eye size={15} /> 1.2K</span>
          </div>
        </div>
      );

    case "LinkedIn":
      return (
        <div className="bg-slate-950 rounded-2xl border border-slate-800 p-5 space-y-4 shadow-xl">
          {/* Header */}
          <div className="flex justify-between items-start">
            <div className="flex gap-3">
              <div className="w-10 h-10 rounded bg-indigo-950 border border-indigo-900 flex items-center justify-center font-bold text-indigo-300">
                SB
              </div>
              <div>
                <div className="flex items-center gap-1">
                  <span className="font-bold text-sm text-slate-100">Shiney Brain Academy</span>
                  <span className="text-[10px] text-indigo-400 font-mono font-bold">• 1st</span>
                </div>
                <span className="text-[11px] text-slate-400 block">Syllabus-aligned EdTech & Learning Systems</span>
                <span className="text-[10px] text-slate-500 font-mono block">1m • Edited • 🌐</span>
              </div>
            </div>
            <MoreHorizontal size={16} className="text-slate-500" />
          </div>

          {/* Text Content */}
          <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap font-sans">{content}</p>

          {/* Attachment */}
          {imageAttach && (
            <div className="rounded-xl overflow-hidden border border-slate-800 bg-slate-900">
              <img src={imageAttach} alt={altText || "LinkedIn Attachment"} className="w-full object-cover max-h-72" />
              <div className="bg-slate-900 p-3 border-t border-slate-800">
                <span className="text-xs font-bold text-slate-200 block truncate">Shiney Brain Academy Syllabus Booster</span>
                <span className="text-[10px] text-slate-400 block font-mono mt-0.5">shineybrainacademy.com • 3 min read</span>
              </div>
            </div>
          )}

          {/* Call to action */}
          {callToAction && (
            <div className="bg-indigo-950/20 border border-indigo-900/60 p-3 rounded-xl flex items-center justify-between text-xs">
              <span className="text-slate-200 font-medium">{callToAction}</span>
              <ExternalLink size={13} className="text-indigo-400" />
            </div>
          )}

          {/* Engagement */}
          <div className="flex justify-between items-center text-[11px] text-slate-400 border-b border-slate-850 pb-2 font-mono">
            <span>👍 32 Likes</span>
            <span>• 3 comments</span>
          </div>

          <div className="flex justify-around items-center pt-1 text-slate-500 text-xs">
            <span className="flex items-center gap-1 hover:text-blue-400 cursor-pointer"><ThumbsUp size={14} /> Like</span>
            <span className="flex items-center gap-1 hover:text-blue-400 cursor-pointer"><MessageCircle size={14} /> Comment</span>
            <span className="flex items-center gap-1 hover:text-blue-400 cursor-pointer"><Share size={14} /> Share</span>
            <span className="flex items-center gap-1 hover:text-blue-400 cursor-pointer"><Send size={14} /> Send</span>
          </div>
        </div>
      );

    case "Facebook":
      return (
        <div className="bg-slate-950 rounded-2xl border border-slate-800 p-5 space-y-4 shadow-xl">
          {/* Header */}
          <div className="flex justify-between items-start">
            <div className="flex gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-950 border border-blue-900 flex items-center justify-center font-bold text-blue-300">
                SB
              </div>
              <div>
                <div className="flex items-center gap-1">
                  <span className="font-bold text-sm text-slate-100">Shiney Brain Academy</span>
                  <span className="text-[11px] text-blue-400 bg-blue-500/10 px-1 rounded">✓</span>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">Just now • 👥</span>
              </div>
            </div>
            <MoreHorizontal size={16} className="text-slate-500" />
          </div>

          {/* Text Content */}
          <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap font-sans">{content}</p>

          {/* Attachment */}
          {imageAttach && (
            <div className="rounded-xl overflow-hidden border border-slate-850 bg-slate-900">
              <img src={imageAttach} alt={altText || "Facebook attachment"} className="w-full object-cover max-h-72" />
            </div>
          )}

          {/* Call to action */}
          {callToAction && (
            <div className="bg-slate-900 p-3 rounded-xl border border-slate-850 flex items-center justify-between text-xs">
              <div className="min-w-0">
                <span className="text-[10px] text-slate-400 block font-mono uppercase tracking-wider">Shiney Brain Portal</span>
                <span className="text-slate-200 font-semibold block truncate">{callToAction}</span>
              </div>
              <button className="bg-blue-600 hover:bg-blue-500 text-white font-semibold text-[10px] px-3 py-1.5 rounded-lg shrink-0 font-mono">
                LEARN MORE
              </button>
            </div>
          )}

          {/* Interactions */}
          <div className="flex justify-between items-center pt-2 border-t border-slate-850 text-slate-500 text-xs">
            <span className="flex items-center gap-1.5 hover:text-blue-500 cursor-pointer"><ThumbsUp size={15} /> Like</span>
            <span className="flex items-center gap-1.5 hover:text-blue-500 cursor-pointer"><MessageCircle size={15} /> Comment</span>
            <span className="flex items-center gap-1.5 hover:text-blue-500 cursor-pointer"><Share size={15} /> Share</span>
          </div>
        </div>
      );

    case "Instagram":
      return (
        <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
          {/* Header */}
          <div className="p-4 flex justify-between items-center border-b border-slate-850">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full p-[1.5px] bg-gradient-to-tr from-pink-500 via-red-500 to-yellow-500">
                <div className="w-full h-full rounded-full bg-slate-950 flex items-center justify-center font-bold text-[10px] text-slate-200">
                  SB
                </div>
              </div>
              <div>
                <span className="font-bold text-xs text-slate-100 block">shiney_brain_academy</span>
                <span className="text-[9px] text-slate-400 font-mono block">Original Audio</span>
              </div>
            </div>
            <MoreHorizontal size={14} className="text-slate-500" />
          </div>

          {/* Media visual box */}
          <div className="bg-slate-900 aspect-square flex items-center justify-center overflow-hidden relative">
            {imageAttach ? (
              <img src={imageAttach} alt={altText || "Instagram visual asset"} className="w-full h-full object-cover" />
            ) : (
              <div className="text-slate-500 font-mono text-[10px] text-center p-4">
                No Instagram image loaded
              </div>
            )}
            <div className="absolute bottom-3 right-3 bg-slate-950/80 border border-slate-800 text-[10px] font-mono text-pink-400 px-2.5 py-1 rounded-full backdrop-blur">
              Carousel Sync Active
            </div>
          </div>

          {/* Description captions */}
          <div className="p-4 space-y-2">
            <div className="flex justify-between items-center text-slate-200">
              <div className="flex gap-3">
                <Heart size={18} className="hover:text-red-500 cursor-pointer" />
                <MessageCircle size={18} className="hover:text-slate-300 cursor-pointer" />
                <Send size={18} className="hover:text-slate-300 cursor-pointer" />
              </div>
              <Bookmark size={18} className="hover:text-slate-300 cursor-pointer" />
            </div>

            <div className="text-xs text-slate-200 leading-relaxed font-sans mt-2">
              <span className="font-bold mr-1.5">shiney_brain_academy</span>
              <span className="whitespace-pre-wrap">{content}</span>
            </div>

            {callToAction && (
              <div className="text-[10px] text-indigo-400 font-mono pt-1">
                🔗 Link in Bio: <span className="underline">{callToAction}</span>
              </div>
            )}

            <span className="text-[9px] text-slate-500 font-mono uppercase block pt-1">1 minute ago</span>
          </div>
        </div>
      );

    case "Telegram":
      return (
        <div className="bg-slate-950 rounded-2xl border border-slate-850 overflow-hidden shadow-xl font-sans">
          <div className="bg-slate-900 border-b border-slate-800 px-4 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-blue-600/20 text-blue-400 flex items-center justify-center font-extrabold text-xs">
                📢
              </div>
              <div>
                <span className="font-bold text-xs text-slate-100 block">Shiney Brain Academy Alerts</span>
                <span className="text-[9px] text-slate-400 font-mono">148,402 subscribers</span>
              </div>
            </div>
            <Eye size={15} className="text-slate-500" />
          </div>

          <div className="p-4 space-y-3">
            {imageAttach && (
              <div className="rounded-lg overflow-hidden border border-slate-850">
                <img src={imageAttach} alt="Telegram broadcast" className="w-full object-cover max-h-52" />
              </div>
            )}
            
            <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap font-sans bg-slate-900/60 p-3 rounded-lg border border-slate-850">
              {content}
            </p>

            {callToAction && (
              <button className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs py-2 rounded-xl transition-all flex items-center justify-center gap-1.5">
                <ExternalLink size={12} />
                <span>{callToAction}</span>
              </button>
            )}
            
            <div className="text-right text-[9px] text-slate-500 font-mono">
              14:43 • Delivered Channel Broadcast
            </div>
          </div>
        </div>
      );

    default:
      return (
        <div className="bg-slate-950 rounded-2xl border border-slate-800 p-5 space-y-3">
          <span className="bg-slate-800 text-slate-300 text-[10px] font-mono px-2 py-0.5 rounded uppercase font-bold">
            {platform} Channel Post
          </span>
          <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap font-sans">{content}</p>
          {imageAttach && (
            <div className="rounded-xl overflow-hidden border border-slate-800 bg-slate-900">
              <img src={imageAttach} alt={platform} className="w-full object-cover max-h-48" />
            </div>
          )}
          {callToAction && (
            <div className="text-xs text-indigo-400 font-mono">
              CTA: {callToAction}
            </div>
          )}
        </div>
      );
  }
}





