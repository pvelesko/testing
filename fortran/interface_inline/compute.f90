module compute_mod
  use my_module
  public :: comp
  contains
    !dir$ attributes forceinline :: comp
    subroutine comp(x, y, z, selector)
      real, intent(in) :: x, y
      real, intent(out) :: z

      interface
        function selector(x, y)
            real :: x, y
            real :: selector
          end function selector
      end interface

      !dir$ forceinline
      z = selector(x, y)

      !di$ forceinline
      z = comp_t(z)


    end subroutine


end module
