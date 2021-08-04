program driver
 use compute_mod
 use my_module
 implicit none

 real :: x, y, z

 !dir$ forceinline
 call comp(x, y, z, fun1)
 write(*,*) "called fun1", x, y, z
end program
