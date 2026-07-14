export interface ServicesToolbarProps {
  query: string;
  onQueryChange: (value: string) => void;
  onRefresh: () => void;
  isFetching: boolean;
}
