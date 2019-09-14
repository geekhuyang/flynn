import State, { testRef } from './WindowedListState';

afterEach(() => {
	testRef.enableDebug = false;
});

it('selects items within viewport to display', () => {
	const state = new State();
	state.length = 1000;
	state.viewportHeight = 400;
	state.defaultHeight = 100;
	state.calculateVisibleIndices();

	expect(state.visibleIndexTop).toEqual(0);
	expect(state.visibleLength).toEqual(4);
});

it('responds to a change in scroll position', () => {
	const state = new State();
	state.length = 1000;
	state.viewportHeight = 400;
	state.defaultHeight = 100;

	state.updateScrollPosition(120);
	expect(state.visibleIndexTop).toEqual(1);
	expect(state.visibleLength).toEqual(4);

	state.updateScrollPosition(90);
	expect(state.visibleIndexTop).toEqual(0);
	expect(state.visibleLength).toEqual(4);
});

it('sets padding for top and bottom equal to height of items out of range', () => {
	const state = new State();
	state.length = 1000;
	state.viewportHeight = 400;
	state.defaultHeight = 100;

	state.calculateVisibleIndices(); // make sure padding is already calculated

	state.updateScrollPosition(220);
	expect(state.visibleIndexTop).toEqual(2);
	expect(state.visibleLength).toEqual(4);
	expect(state.paddingTop).toEqual(200);
	expect(state.paddingBottom).toEqual(99400);

	state.updateScrollPosition(200);
	expect(state.visibleIndexTop).toEqual(2);
	expect(state.visibleLength).toEqual(4);
	expect(state.paddingTop).toEqual(200);
	expect(state.paddingBottom).toEqual(99400);

	state.updateScrollPosition(100);
	expect(state.visibleIndexTop).toEqual(1);
	expect(state.visibleLength).toEqual(4);
	expect(state.paddingTop).toEqual(100);
	expect(state.paddingBottom).toEqual(99500);

	state.updateScrollPosition(10);
	expect(state.visibleIndexTop).toEqual(0);
	expect(state.visibleLength).toEqual(4);
	expect(state.paddingTop).toEqual(0);
	expect(state.paddingBottom).toEqual(99600);

	state.updateScrollPosition(0);
	expect(state.visibleIndexTop).toEqual(0);
	expect(state.visibleLength).toEqual(4);
	expect(state.paddingTop).toEqual(0);
	expect(state.paddingBottom).toEqual(99600);
});

it('responds to a change in item heights', () => {
	const state = new State();
	state.length = 1000;
	state.viewportHeight = 400;
	state.defaultHeight = 100;

	state.updateHeightAtIndex(1, 250);
	expect(state.visibleIndexTop).toEqual(0);
	expect(state.visibleLength).toEqual(3);

	state.updateHeightAtIndex(0, 250);
	state.calculateVisibleIndices();
	expect(state.visibleIndexTop).toEqual(0);
	expect(state.visibleLength).toEqual(2);
});

it('padding reflects actual item heights', () => {
	const state = new State();
	state.length = 1000;
	state.viewportHeight = 400;
	state.defaultHeight = 100;

	state.calculateVisibleIndices();

	state.updateHeightAtIndex(0, 250);
	state.updateHeightAtIndex(10, 250);
	state.updateHeightAtIndex(11, 250);
	state.updateHeightAtIndex(12, 250);
	state.updateScrollPosition(400);

	expect(state.visibleIndexTop).toEqual(2);
	expect(state.visibleLength).toEqual(4);
	expect(state.paddingTop).toEqual(350);
	expect(state.paddingBottom).toEqual(99850);
});
