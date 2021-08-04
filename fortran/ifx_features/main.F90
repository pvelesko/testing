module test

  type derived_type
    integer, allocatable, dimension(:) :: myint
  end type

  integer, allocatable :: myint(:)

  contains 
    subroutine test_alloc
      allocate(myint(3))
    end subroutine
end module

program mainprog
  use test
  implicit none
  type(derived_type) :: mytype
  call test_alloc()
  myint(1) = 0

end program
