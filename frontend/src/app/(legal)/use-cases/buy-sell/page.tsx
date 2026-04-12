import { Handshake24Regular } from '@fluentui/react-icons';
import UseCasePage from '../UseCasePage';

export default function BuySellPage() {
  return (
    <UseCasePage
      useCaseKey="buySell"
      icon={<Handshake24Regular className="w-10 h-10" />}
      gradient="bg-gradient-to-br from-red-500 to-red-500"
    />
  );
}
