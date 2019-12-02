function scrubIds(tuples) {
  return tuples.map((t) => {
    delete t.id;
    return t;
  });
}

function rewriteKeys(tuples, obj) {
  return tuples.map((t) => {
    Object.keys(obj).forEach((k) => {
      if (k in t) {
        t[obj[k]] = t[k];
        delete t[k];
      }
    });
  });
}


module.exports = {
  scrubIds,
  rewriteKeys
};
