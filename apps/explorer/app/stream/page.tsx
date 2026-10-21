'use client';

import { PageIntro } from '@bunkercoin/ui';
import LabCamera from '@/components/lab-camera';

export default function StreamPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageIntro title="Lab camera." lead="The radio lab, live. Opens muted." />
      <LabCamera autoplay streamLink={false} />
    </div>
  );
}
