'use client';

import dynamic from 'next/dynamic';

const ShareButtons = dynamic(() => import('@/components/ShareButtons'), { ssr: false });
const MarkDoneButton = dynamic(() => import('@/components/MarkDoneButton'), { ssr: false });
const Comments = dynamic(() => import('@/components/Comments'), { ssr: false });
const PodcastPlayer = dynamic(() => import('@/components/PodcastPlayer'), { ssr: false });
const RatingWidget = dynamic(() => import('@/components/RatingWidget'), { ssr: false });

export function BlogShareButtons(props) {
  return <ShareButtons {...props} />;
}

export function BlogMarkDoneButton(props) {
  return <MarkDoneButton {...props} />;
}

export function BlogComments(props) {
  return <Comments {...props} />;
}

export function BlogPodcastPlayer(props) {
  return <PodcastPlayer {...props} />;
}

export function BlogRatingWidget(props) {
  return <RatingWidget {...props} />;
}
