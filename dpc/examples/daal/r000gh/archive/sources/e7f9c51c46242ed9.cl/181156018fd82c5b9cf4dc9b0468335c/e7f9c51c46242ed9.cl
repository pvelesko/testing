__kernel void addBetaIntercept(const __global algorithmFPType *beta, uint nBetas, __global algorithmFPType *yTable, uint nResponses) { uint rowIdx = get_global_id(0); uint colIdx = get_global_id(1); algorithmFPType value = yTable[rowIdx*nResponses + colIdx]; yTable[rowIdx*nResponses + colIdx] = value + beta[colIdx*nBetas]; } 