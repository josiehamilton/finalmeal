import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { ApiError, createCustomPlace } from '@finalmeal/api';
import CustomPlace from '../../app/(app)/add/custom-place';
import { PLACE, readDraft, withDraft } from '../test-support/add-dish';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), dismissTo: jest.fn() };
let mockParams: Record<string, string> = { name: 'Taco Truck' };
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => mockParams,
}));
jest.mock('@finalmeal/api', () => ({
  ...jest.requireActual('@finalmeal/api'),
  createCustomPlace: jest.fn(),
}));
jest.mock('../providers/SessionProvider', () => ({
  useSession: () => ({
    session: {},
    profile: jest.requireActual('../test-support/profile').makeProfile({ homeCity: null }),
    loading: false,
    error: null,
  }),
}));
jest.mock('../lib/supabase', () => ({ getSupabase: () => ({ fake: 'client' }) }));
jest.mock('../components/CityPicker', () => {
  const { Pressable, Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    CityPicker: ({
      onChange,
      initialLabel,
      allowCurrentLocation,
    }: {
      onChange: (city: unknown) => void;
      initialLabel?: string;
      allowCurrentLocation?: boolean;
    }) => (
      <>
        <Text testID="city-prefill">{initialLabel ?? ''}</Text>
        <Text>{allowCurrentLocation === false ? 'no location button' : 'location button'}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => onChange({ id: 'c9', label: 'Tokyo, Japan' })}
        >
          <Text>pick Tokyo</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => onChange(null)}>
          <Text>edit city text</Text>
        </Pressable>
      </>
    ),
  };
});
const mockCreate = jest.mocked(createCustomPlace);

const CITY = { id: 'c1', label: 'Vancouver, BC, Canada', point: { lat: 49.28, lng: -123.12 } };
const addSpot = () => screen.getByRole('button', { name: 'Add spot' });
const publicBox = () => screen.getByRole('checkbox', { name: 'This spot is open to the public' });
const noAddressBox = () =>
  screen.getByRole('checkbox', { name: 'No fixed address (food truck or pop-up)' });

async function show(initial = { searchCity: CITY }) {
  await render(withDraft(<CustomPlace />, initial));
}

describe('Add a spot', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParams = { name: 'Taco Truck' };
    mockCreate.mockResolvedValue({ ...PLACE, id: 'p-new', name: 'Taco Truck', source: 'custom' });
  });

  it('has the title, the public-business intro and the fields', async () => {
    await show();
    expect(screen.getByText('Add a spot')).toBeOnTheScreen();
    expect(
      screen.getByText(
        'Restaurants, cafés, food trucks and pop-ups: anywhere the public can eat. Please don’t add someone’s home.',
      ),
    ).toBeOnTheScreen();
    expect(screen.getByPlaceholderText('123 Main St')).toBeOnTheScreen();
    expect(screen.getByText('Street address')).toBeOnTheScreen();
  });

  it('prefills the name from the search and the city from the search city', async () => {
    await show();
    expect(screen.getByDisplayValue('Taco Truck')).toBeOnTheScreen();
    expect(screen.getByTestId('city-prefill')).toHaveTextContent('Vancouver, BC, Canada');
  });

  it('has no current-location button in its city picker', async () => {
    await show();
    expect(screen.getByText('no location button')).toBeOnTheScreen();
  });

  it('stays disabled without an address, even with the public-spot box ticked', async () => {
    await show();
    await fireEvent.press(publicBox());
    expect(addSpot()).toBeDisabled();
  });

  it('stays disabled until the public-spot box is ticked', async () => {
    await show();
    await fireEvent.changeText(screen.getByPlaceholderText('123 Main St'), '123 Main St');
    expect(addSpot()).toBeDisabled();
    await fireEvent.press(publicBox());
    expect(publicBox()).toBeChecked();
    expect(addSpot()).toBeEnabled();
  });

  it('is enabled with No fixed address instead of an address, which clears and disables the field', async () => {
    await show();
    await fireEvent.changeText(screen.getByPlaceholderText('123 Main St'), '123 Main St');
    await fireEvent.press(noAddressBox());
    expect(screen.getByPlaceholderText('123 Main St')).toHaveDisplayValue('');
    expect(screen.getByPlaceholderText('123 Main St')).toBeDisabled();
    await fireEvent.press(publicBox());
    expect(addSpot()).toBeEnabled();
  });

  it('is disabled without a name or a city', async () => {
    await show();
    await fireEvent.changeText(screen.getByPlaceholderText('123 Main St'), '123 Main St');
    await fireEvent.press(publicBox());
    await fireEvent.press(screen.getByText('edit city text'));
    expect(addSpot()).toBeDisabled();
    await fireEvent.press(screen.getByText('pick Tokyo'));
    expect(addSpot()).toBeEnabled();
    await fireEvent.changeText(screen.getByDisplayValue('Taco Truck'), '  ');
    expect(addSpot()).toBeDisabled();
  });

  it('creates the spot with the address, sets it on the draft and returns to the form', async () => {
    await show();
    await fireEvent.changeText(screen.getByPlaceholderText('123 Main St'), ' 123 Main St ');
    await fireEvent.press(publicBox());
    await fireEvent.press(addSpot());
    await act(async () => {});
    expect(mockCreate).toHaveBeenCalledWith(
      { fake: 'client' },
      { name: 'Taco Truck', cityId: 'c1', address: '123 Main St', noFixedAddress: false },
    );
    expect(readDraft(screen).place?.id).toBe('p-new');
    expect(mockRouter.dismissTo).toHaveBeenCalledWith('/add');
  });

  it('sends noFixedAddress and no address for a food truck, in the city picked', async () => {
    await show();
    await fireEvent.press(screen.getByText('pick Tokyo'));
    await fireEvent.press(noAddressBox());
    await fireEvent.press(publicBox());
    await fireEvent.press(addSpot());
    await act(async () => {});
    expect(mockCreate).toHaveBeenCalledWith(
      { fake: 'client' },
      { name: 'Taco Truck', cityId: 'c9', address: undefined, noFixedAddress: true },
    );
  });

  it('shows the friendly address_required copy inline and stays', async () => {
    mockCreate.mockRejectedValue(new ApiError('address needed', 'address_required'));
    await show();
    await fireEvent.changeText(screen.getByPlaceholderText('123 Main St'), '1');
    await fireEvent.press(publicBox());
    await fireEvent.press(addSpot());
    await act(async () => {});
    expect(
      screen.getByText('Add the street address, or mark it as a food truck or pop-up.'),
    ).toBeOnTheScreen();
    expect(mockRouter.dismissTo).not.toHaveBeenCalled();
  });

  it('works without a search city (the person picks one) and goes back', async () => {
    await render(withDraft(<CustomPlace />));
    expect(addSpot()).toBeDisabled();
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(mockRouter.back).toHaveBeenCalled();
  });
});
