module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // react-native-reanimated precisa desse plugin, e ele TEM que ser o
    // último da lista — é uma exigência da própria lib (ela reescreve o
    // código depois de todos os outros plugins já terem rodado).
    plugins: ['react-native-reanimated/plugin'],
  };
};
