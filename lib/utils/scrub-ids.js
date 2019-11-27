module.exports = function(tuples) {
  return tuples.map((t) => {
    delete t.id;
    return t;
  });
};
