// Reconstruct a reviewed historical renderer without dropping any assertions.
// C12's broad scope pins still run against the original three C13 painters;
// C13 independently pins their old and new complete cycles and audits scope.
export function restoreFoeRoundTwo(source,reference){
 for(const name of ['drawHzBeartrap','drawHzPendulum','drawHzSnowball']){
  const pattern=new RegExp('function '+name+'\\([^]*?\\n}\\n')
  source=source.replace(pattern,reference.match(pattern)[0])
 }
 const fine=/  beartrap: (?:function \([^]*?\n  },|drawTrapFine,)\n/
 const swing=/function hzSwing\([^]*?\n}\n/
 return source.replace(fine,reference.match(fine)[0])+reference.match(swing)[0]
}
