program test
  use iso_c_binding, only : c_int
  implicit none
  integer(kind=c_int) :: num=3
  write(*,*) 'Hello From Fortran', num
  call hellodpcpp(num)
end program

