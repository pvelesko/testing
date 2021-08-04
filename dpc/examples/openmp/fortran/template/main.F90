program test
  implicit none
  integer :: x(3), i, j, k

  !$omp target
  !$omp teams distribute
  do j=1,3
  !$omp parallel do 
  do i=1,3
  x(i) = i
  end do
  !$omp end parallel do
  end do
  !$omp end teams distribute
  !$omp end target
end program
