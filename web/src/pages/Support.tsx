import React from 'react';
import { Link } from 'react-router-dom';

const Support = () => {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Support</h1>
      <p className="text-muted-foreground mb-4">
        There is no support desk yet. Send a message through the feedback form and it reaches the team.
      </p>
      <div className="glass-card p-6 rounded-lg">
        <h2 className="text-xl font-semibold mb-4">Customer Support</h2>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            Problems or questions:{' '}
            <Link to="/settings" className="underline">
              Settings
            </Link>
            , Support (or Advanced on a phone), Feedback &amp; Support.
          </li>
          <li>
            Someone made you feel unsafe: report and block them from the chat menu, and see the{' '}
            <Link to="/safety" className="underline">
              Safety centre
            </Link>
            .
          </li>
          <li>In immediate danger: call your local emergency number (112).</li>
        </ul>
      </div>
    </div>
  );
};

export default Support;
