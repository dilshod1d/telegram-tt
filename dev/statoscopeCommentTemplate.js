/* eslint-env node */

// Keep the formatter local: workflow files are not included in every source checkout.
module.exports = (data) => {
  const json = JSON.stringify(data, undefined, 2);
  const fence = '`'.repeat(Math.max(3, ...Array.from(json.matchAll(/`+/g), ([match]) => match.length + 1)));
  return `Statoscope validation for #${data.prNumber}\n\n${fence}json\n${json}\n${fence}`;
};
