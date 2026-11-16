import { queryOptions } from "@tanstack/react-query";
import { listNotices } from "./notices.functions";

export const noticesQueryOptions = () =>
  queryOptions({
    queryKey: ["notices"],
    queryFn: () => listNotices(),
    staleTime: 30_000,
  });
