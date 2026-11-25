import { Link } from 'react-router';

/** Bandeau affiché à l'administrateur quand il regarde l'espace avec les yeux du client. */
export default function PreviewBanner({ clientName, backTo }: { clientName: string; backTo: string }) {
  return (
    <div className="alert alert-info preview-bar" role="status">
      <span>
        <strong>Vue client</strong> : vous voyez l'espace comme {clientName || 'le client'}. Les documents masqués ou en brouillon n'apparaissent pas, et les actions du client sont désactivées.
      </span>
      <Link to={backTo} className="btn btn-sm">Revenir à l'admin</Link>
    </div>
  );
}

/** En vue client, les documents tels que le client les voit (mêmes règles que la sécurité de la base). */
export function clientVisible<T extends { visible: boolean; status: string }>(docs: T[]): T[] {
  return docs.filter((d) => d.visible && d.status !== 'brouillon');
}
