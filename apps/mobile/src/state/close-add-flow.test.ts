import { closeAddFlow, swapHref } from './add-flow-base';

describe('closeAddFlow', () => {
  it('dismisses to where Add was opened from', () => {
    const router = { dismissTo: jest.fn() };
    closeAddFlow(router, '/feed');
    expect(router.dismissTo).toHaveBeenCalledWith('/feed');
  });

  it('dismisses to the You tab when nobody said where it opened from', () => {
    const router = { dismissTo: jest.fn() };
    closeAddFlow(router, undefined);
    expect(router.dismissTo).toHaveBeenCalledWith('/(app)/you');
  });

  it('ignores a from that is not an app path', () => {
    const router = { dismissTo: jest.fn() };
    closeAddFlow(router, 'https://elsewhere.example');
    closeAddFlow(router, '');
    expect(router.dismissTo).toHaveBeenNthCalledWith(1, '/(app)/you');
    expect(router.dismissTo).toHaveBeenNthCalledWith(2, '/(app)/you');
  });
});

describe('swapHref', () => {
  it('is the plain route with no extras', () => {
    expect(swapHref(undefined)).toBe('/add/swap');
  });

  it('carries where Add opened from', () => {
    expect(swapHref('/feed')).toEqual({ pathname: '/add/swap', params: { from: '/feed' } });
  });

  it('carries the pick to promote too', () => {
    expect(swapHref('/feed', 'pk1')).toEqual({
      pathname: '/add/swap',
      params: { promote: 'pk1', from: '/feed' },
    });
    expect(swapHref(undefined, 'pk1')).toEqual({
      pathname: '/add/swap',
      params: { promote: 'pk1' },
    });
  });
});
