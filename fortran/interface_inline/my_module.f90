module my_module

public :: fun1, fun2
public :: sub1, sub2

contains
  !dir$ attributes forceinline :: fun1,fun2,sub1,sub2
  function fun1(x, y)
    implicit none
    real :: fun1, x, y

    fun1 = x +y

  end function fun1
  function fun2(x, y)
    implicit none
    real :: fun2, x, y

    fun2 = x +y

  end function fun2
    subroutine sub1(x, y, z)
      implicit none
      real, intent(in) ::  x, y
      real, intent(out) ::  z

      z = x +y

    end subroutine
    subroutine sub2(x, y, z)
      implicit none
      real, intent(in) ::  x, y
      real, intent(out) :: z

      z = x +y

    end subroutine

    function comp_t(x)
      real :: comp_t, x
      comp_t = x + 1
      end function

end module
