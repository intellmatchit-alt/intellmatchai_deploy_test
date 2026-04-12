import { Lightbulb24Regular } from '@fluentui/react-icons';
import UseCasePage from '../UseCasePage';

export default function HaveProjectPage() {
  return (
    <UseCasePage
      useCaseKey="haveProject"
      icon={<Lightbulb24Regular className="w-10 h-10" />}
      gradient="bg-gradient-to-br from-yellow-500 to-cyan-500"
    />
  );
}
