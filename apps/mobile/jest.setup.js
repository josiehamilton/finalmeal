// Native modules that have no implementation under Jest.
jest.mock('react-native-get-random-values', () => ({}));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
