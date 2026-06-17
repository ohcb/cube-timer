function randomChoice(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function generateSequence(moves, length, avoidSameAxis = true) {
  const scramble = [];
  let lastAxis = '';

  while (scramble.length < length) {
    const move = randomChoice(moves);
    const axis = move.replace(/[w2'()\/\s-]/g, '')[0];

    if (avoidSameAxis && axis === lastAxis) continue;

    lastAxis = axis;
    scramble.push(`${move}${randomChoice(['', "'", '2'])}`);
  }

  return scramble.join(' ');
}

function generateScramble(eventId) {
  if (eventId === '222') {
    return generateSequence(['R', 'U', 'F'], 11);
  }

  if (eventId === '444') {
    return generateSequence(['R', 'L', 'U', 'D', 'F', 'B', 'Rw', 'Uw', 'Fw'], 40);
  }

  if (eventId === '555' || eventId === '666' || eventId === '777') {
    return generateSequence(
      ['R', 'L', 'U', 'D', 'F', 'B', 'Rw', 'Lw', 'Uw', 'Dw', 'Fw', 'Bw'],
      eventId === '555' ? 60 : 80
    );
  }

  if (eventId === '333oh' || eventId === '333bf') {
    return generateSequence(['R', 'L', 'U', 'D', 'F', 'B'], 25);
  }

  if (eventId === 'pyram') {
    return generateSequence(['R', 'L', 'U', 'B', 'r', 'l', 'u', 'b'], 12, false);
  }

  if (eventId === 'skewb') {
    return generateSequence(['R', 'L', 'U', 'B'], 11, false);
  }

  if (eventId === 'minx') {
    return Array.from(
      { length: 7 },
      () => `${randomChoice(['R++','R--'])} ${randomChoice(['D++','D--'])}`
    ).join(' ') + ` ${randomChoice(['U', "U'"])}`;
  }

  if (eventId === 'sq1') {
    return Array.from(
      { length: 12 },
      () => `(${Math.floor(Math.random() * 7) - 3},${Math.floor(Math.random() * 7) - 3}) /`
    ).join(' ');
  }

  if (eventId === 'clock') {
    return Array.from(
      { length: 14 },
      () =>
        randomChoice(['UR','DR','DL','UL','U','R','D','L','ALL']) +
        randomChoice(['0+','1+','2+','3+','4+','5+','1-','2-','3-','4-','5-'])
  ).join(' ');
}

  return generateSequence(['R', 'L', 'U', 'D', 'F', 'B'], 25);
}
