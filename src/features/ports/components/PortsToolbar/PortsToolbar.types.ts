export interface PortsToolbarProps {
  query: string;
  onQueryChange: (value: string) => void;
  listeningOnly: boolean;
  onListeningChange: (listeningOnly: boolean) => void;
  onRefresh: () => void;
  isFetching: boolean;
}
