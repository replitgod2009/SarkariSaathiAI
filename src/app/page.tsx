import {Workspace} from '@/components/Workspace';
import {providerInfo} from '@/lib/server/ai';
export const dynamic='force-dynamic';
export default function Home(){return <Workspace provider={providerInfo()}/>}
