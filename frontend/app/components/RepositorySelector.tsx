'use client';

interface Repository {
  name: string;
  path: string;
}

interface Props {
  repositories: Repository[];
  selected: string;
  onChange: (repo: string) => void;
}

export function RepositorySelector({ repositories, selected, onChange }: Props) {
  if (!repositories || repositories.length === 0) {
    return (
      <select className="px-4 py-2 border border-gray-300 rounded-lg bg-gray-100" disabled>
        <option>Loading repositories...</option>
      </select>
    );
  }

  return (
    <select
      value={selected}
      onChange={(e) => onChange(e.target.value)}
      className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      {repositories.map((repo) => (
        <option key={repo.name} value={repo.name}>
          {repo.name}
        </option>
      ))}
    </select>
  );
}
