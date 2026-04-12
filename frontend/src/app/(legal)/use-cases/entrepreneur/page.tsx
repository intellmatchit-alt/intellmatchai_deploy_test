import { Rocket24Regular } from '@fluentui/react-icons';
import UseCasePage from '../UseCasePage';

export default function EntrepreneurPage() {
  return (
    <UseCasePage
      useCaseKey="entrepreneur"
      icon={<Rocket24Regular className="w-10 h-10" />}
      gradient="bg-gradient-to-br from-emerald-500 to-teal-500"
    />
  );
}
