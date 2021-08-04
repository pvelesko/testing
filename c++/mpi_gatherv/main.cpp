#include "mpi.h"
#include <iostream>

int main() {
  int world_rank, world_size;
  MPI_Init(NULL, NULL);
  MPI_Comm_rank(MPI_COMM_WORLD, &world_rank);
  MPI_Comm_size(MPI_COMM_WORLD, &world_size);

  int arr[10] = { 0, 1, 2, 3, 4, 5, 6, 7, 8, 9};
  int sizes[3] = {4, 3, 3};
  int disp[3] = {0, 4, 7};
  int start;

  if (world_rank == 0) {
    start = 4;
  }

  int recvb[10] = {0,0,0,0,0,0,0,0,0};

  if (world_rank == 0) {
  std::cout << "Proc# " << world_rank << std::endl;
  for (int i = 0; i < 10; i++)
    std::cout << recvb[i] << " ";
  std::cout << std::endl;
  }

  MPI_Gatherv(arr+disp[world_rank], sizes[world_rank], MPI_INT, recvb, sizes, disp, MPI_INT, 0, MPI_COMM_WORLD);

  if (world_rank == 0) {
  std::cout << "Proc# " << world_rank << std::endl;
  for (int i = 0; i < 10; i++)
    std::cout << recvb[i] << " ";
  std::cout << std::endl;
  }


}
