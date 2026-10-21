'use client';

import { PageIntro } from '@bunkercoin/ui';
import LabCamera from '@/components/lab-camera';
import { RadioPanel, ValidatorsPanel } from '@/components/network-panels';

export default function NetworkPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageIntro title="Network." />
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          <ValidatorsPanel />
          <div id="radio">
            <RadioPanel />
          </div>
        </div>
        <LabCamera />
      </div>
    </div>
  );
}
