/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useMemo, useState } from "react";

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

  const setKeyword = (keyword: string) => {
    setState((current) => ({
      ...current,
      keyword,
      page: 1,
    }));
  };

  const setPagination = (page: number, pageSize: number) => {
    setState((current) => ({
      ...current,
      page,
      pageSize,
    }));
  };

  const reset = () => {
    setState({
      ...defaultPageState,
      ...initialState,
    });
  };

  return {
    pageState: state,
    query,
    setKeyword,
    setPagination,
    reset,
  };
}

