import { People24Regular } from '@fluentui/react-icons';
import UseCasePage from '../UseCasePage';

export default function HiringPage() {
  return (
    <UseCasePage
      useCaseKey="hiring"
      icon={<People24Regular className="w-10 h-10" />}
      gradient="bg-gradient-to-br from-green-500 to-emerald-500"
    />
  );
}
