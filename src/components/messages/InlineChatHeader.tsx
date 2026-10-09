import React from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface InlineChatHeaderProps {
  matchName: string;
  onClose: () => void;
}

const InlineChatHeader: React.FC<InlineChatHeaderProps> = ({ matchName, onClose }) => (
  <div className="bg-island p-4 border-b border-island-light/20 flex justify-between items-center">
    <h3 className="font-semibold text-white">{matchName}</h3>
    <Button variant="ghost" size="icon" onClick={onClose} className="text-white hover:bg-island-light/20" aria-label="Close chat">
      <X size={18} />
    </Button>
  </div>
);

export default InlineChatHeader;
