/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useCallback, useMemo, useState } from "react";

export type PageState = {
  page: number;
  pageSize: number;
  keyword: string;
};

const defaultPageState: PageState = {
  page: 1,
  pageSize: 10,
  keyword: "",
};

export function usePageState(initialState?: Partial<PageState>) {
  const [state, setState] = useState<PageState>({
    ...defaultPageState,
    ...initialState,
  });

  const query = useMemo(
    () => ({
      page: state.page,
      pageSize: state.pageSize,
      keyword: state.keyword.trim(),
    }),
    [state],
  );

  const setKeyword = useCallback((keyword: string) => {
    setState((current) => ({
      ...current,
      keyword,
      page: 1,
    }));
  }, []);

  const setPagination = useCallback((page: number, pageSize: number) => {
    setState((current) => {
      if (current.page === page && current.pageSize === pageSize) {
        return current;
      }
      return {
        ...current,
        page,
        pageSize,
      };
    });
  }, []);

  const reset = useCallback(() => {
    setState((current) => {
      const nextState = {
        ...defaultPageState,
        ...initialState,
      };
      if (
        current.page === nextState.page &&
        current.pageSize === nextState.pageSize &&
        current.keyword === nextState.keyword
      ) {
        return current;
      }
      return nextState;
    });
  }, [initialState]);

  return {
    pageState: state,
    query,
    setKeyword,
    setPagination,
    reset,
  };
}

