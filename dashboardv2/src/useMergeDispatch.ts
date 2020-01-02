import * as React from 'react';

type Dispatcher<Action> = (actions: Action | Action[]) => void;

export default function useMergeDispatch<Action>(a: Dispatcher<Action>, b: Dispatcher<Action>) {
	const dispatch = React.useCallback(
		(actions: Action | Action[]) => {
			a(actions);
			b(actions);
		},
		[a, b]
	);
	return dispatch;
}
