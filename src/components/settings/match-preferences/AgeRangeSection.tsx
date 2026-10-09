import { useEffect, useState } from 'react';
import { Slider } from '@/components/ui/slider';

interface AgeRangeSectionProps {
  value: [number, number];
  disabled?: boolean;
  onCommit: (value: [number, number]) => Promise<void>;
}

const AgeRangeSection = ({ value, disabled, onCommit }: AgeRangeSectionProps) => {
  const [draft, setDraft] = useState<[number, number]>(value);

  useEffect(() => setDraft(value), [value]);

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-medium text-love">Age Range</h4>
      <div className="py-6 px-2">
        <Slider
          value={draft}
          min={18}
          max={100}
          step={1}
          disabled={disabled}
          aria-label="Age range"
          onValueChange={(values) => setDraft([values[0], values[1]])}
          onValueCommit={(values) => onCommit([values[0], values[1]])}
          className="mt-6"
        />
        <div className="flex justify-between mt-2 text-sm text-muted-foreground">
          <span>{draft[0]} years</span>
          <span>{draft[1]} years</span>
        </div>
      </div>
    </div>
  );
};

export default AgeRangeSection;
