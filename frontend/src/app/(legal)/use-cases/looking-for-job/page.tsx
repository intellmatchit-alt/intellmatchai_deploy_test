import { Briefcase24Regular } from '@fluentui/react-icons';
import UseCasePage from '../UseCasePage';

export default function LookingForJobPage() {
  return (
    <UseCasePage
      useCaseKey="lookingForJob"
      icon={<Briefcase24Regular className="w-10 h-10" />}
      gradient="bg-gradient-to-br from-blue-500 to-cyan-500"
    />
  );
}
