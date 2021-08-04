#ifdef USE_ASYNC
#define ASYNC(istream)  async(istream)
#else
#define ASYNC(istream)
#endif

!> XGC's multi-species Fokker-Planck-Landau collision operator
!! see R. Hager et al., Journal of Computational Physics 315 (2016), pp. 644-660
!!     E. S. Yoon et al., Physics of Plasmas 21 (2014), 032503
!!
!! The headers of the subroutines in this module refer to the corresponding parts of Hager et al. 
!! where applicable in order to make the source code easier to understand.
!!
module col_f_module
  integer :: col_f_nthreads = 1        !< number of OpenMP threads used in the inner nested level
  integer :: col_f_nvr, col_f_nvz      !< The number of "GRIDS" in vr and vz, respectively
  integer :: col_f_nvrm1, col_f_nvzm1  !< To enhance understandings of compiler and conseq. to avoid temp. copy
  integer :: col_f_nvrm1_nvzm1         !< To enhance understandings of compiler and conseq. to avoid temp. copy
  real (kind=8) :: col_f_vp_max        !< Max v_para of velocity-grid
  real (kind=8) :: col_f_smu_max       !< Max v_perp of velocity-grid
  real (kind=8) :: col_f_dvp           !< v_para grid spacing
  real (kind=8) :: col_f_dsmu          !< v_perp grid spacing
  integer :: col_f_ntotal_v            !< set in col_f_setup
  real (kind=8) :: col_f_dt            !< Time step for collision operation
  integer, allocatable, dimension(:,:) :: index_map_LU
  integer, allocatable, dimension(:) :: LU_cvalues, LU_rowindx, LU_colptr
  integer :: LU_n, LU_nnz, LU_nrhs, LU_ldb

  type col_f_sp_type
     integer :: spid    !! [setup_col_sp] species ID
     integer :: nodeid  !! [setup_col_sp] (mesh) node ID
     real (kind=8) :: T_avg  !! [setup_col_sp]
     real (kind=8) :: mass_au !! [setup_col_sp]
     real (kind=8) :: charge_eu  !! [setup_col_sp]
     real (kind=8) :: vpar_beg   !! [setup_col_sp]
     real (kind=8) :: den_lambda_gamma !! [setup_col_sp]
     real (kind=8) :: conv_factor !! [get_local_f<setup_col_sp]
     real (kind=8), allocatable, dimension(:,:) :: pdf_n     !![get_local_f<setup_col_sp] Given initial PDF
     real (kind=8), allocatable, dimension(:,:) :: pdf_np1   !![get_local_f<setup_col_sp] To be used as PDF at next Picard step. BUT has a role of "df" at end
     real (kind=8), allocatable, dimension(:,:) :: df_corr   !![get_local_f<setup_col_sp]
     real (kind=8), allocatable, dimension(:,:,:) :: ED   ! 5 x (col_f_nvr-1) x (col_f_nvz-1)
     !!!! ## ----- For the purpose of diagnosis (print_snapshot)
     !!real (kind=8) :: numeric_T_par, numeric_T_perp
     !!real (kind=8) :: numeric_dens

     !! Below is from obsolete col_f_core_type
     real (kind=8) :: numeric_vth2, & !![col_fm_core_init<col_fm_core]
                      numeric_T, &  !![col_fm_core_init<col_fm_core]
                      numeric_vtheq2 !! numeric_vtheq2 is for compatability with col_f_core_type. numeric_Teq is not needed.
     real (kind=8) :: mass, &  !![setup_col_sp]
                      mesh_dz, mesh_dr, &  !![setup_col_sp]
                      dens, ens, mom !! [col_fm_core_init<col_fm_core]
     real (kind=8), allocatable, dimension(:) :: mesh_r, mesh_r_half, &  !![setup_col_sp]
                                                 mesh_z, mesh_z_half, &  !![setup_col_sp]
                                                 local_center_volume, &  !![setup_col_sp]
                                                 vol !![setup_col_sp]
     real (kind=8), allocatable, dimension(:,:) :: delta_r, delta_z
  end type col_f_sp_type

  type(col_f_sp_type), allocatable :: col_sp_cell_all(:,:)

  integer :: col_f_sp_s, col_f_sp_e               !! [col_f_setup] the (starting, ending) index of species to be collided
                                                  !!              i.e. species to be collided = sp[col_f_sp_s, col_f_sp_e]
                                                  !!              You can play with this parameter to choose part of species to be collided
  integer :: col_f_sp_num                         !! [col_f_setup] the number of species to be collided ( = col_f_sp_index_e-col_f_sp_index_s+1 )
  integer :: col_f_i_nthreads                     !! [col_f_setup] the number of inner OMP threads
  integer :: col_f_o_nthreads                     !! [col_f_setup] the number of outer OMP threads

  !! <BIG MEMORY ALLOCATION>
  !! Rough estimate on (minimal) memory requirements for N spcies / 1 outer thread
  !! N x 1.10 Mbyte + N(N-1) x 19.8 Mbyte
  !! [1  Outer thread] N=1 : 1.10 Mbyte, N=2 : 61.6 Mbyte, N=3 : 122  Mbyte, N=4 : 242  Mbyte
  !! [8  Outer thread] N=1 : 8.80 Mbyte, N=2 : 493  Mbyte, N=3 : 977  Mbyte, N=4 : 1.89 Gbyte
  !! [16 Outer thread] N=1 : 17.6 Mbyte, N=2 : 986  Mbyte, N=3 : 1.90 Gbyte, N=4 : 3.78 Gbyte
  real(kind=8), allocatable, dimension(:,:,:) :: gammac_spall  !![setup_col_sp]
  !! ## ----- Memory for 1 self-interaction, M_s  : 8 byte x (31x31x63) x5 = 2.31Mbyte (Kernel default)
  !! ##                                           :        x (31x31x30) x5 = 1.10Mbyte (XGC default)
  !!   -  Self-interaction can be cut down to x3/5 memory using the conservation identity
  real (kind=8), dimension(:,:,:,:,:), allocatable :: M_s
  !! ## ----- Memory for 1 cross-interaction, M_ab : 8 byte x (31x63x31x63) x3 = 87.3Mbyte  (Kernel default)
  !! ##                                            :        x (31x30x31x30) x3 = 19.8Mbyte  (XGC default)
  real (kind=8), dimension(:,:,:,:,:,:), allocatable :: M_ab
  !!!!DIR$ ATTRIBUTES FASTMEM :: M_ab    !!!quad-cache mode will cause memory allocation error. quad-flat with numactl has not been tested yet

  !! <SOLVER-related>
  integer, parameter :: vpic_inner_iter_max = 20

  integer, private, parameter :: MAX_THREADS=32

  ! ------------------------------------------------------------
  ! set use_superlu = .true. to use sparse direct SuperLU solver
  ! set use_superlu = .false. to use lapack band solver
  ! ------------------------------------------------------------
  logical, parameter :: use_superlu = .false.

  integer ::  col_f_mat_list(MAX_THREADS)
  integer ::  col_f_vecb_list(MAX_THREADS)
  integer ::  col_f_vecx_list(MAX_THREADS)
  integer ::  col_f_ksp_list(MAX_THREADS)


  contains
    ! BLAS solver collision operator time-stepping
!#include "bsolver.F90"

    !> Set up global variables of the collision operator
    !! @param[in]   isp   Index of 1st particle species, integer
    !! @param[in]   nsp   Index of last particle species, integer
    !! @param[in]   nmu   Grid size in v_perp direction, integer
    !! @param[in]   nvp   Grid size in v_parallel direction, integer
    !! @param[in]   dt    Time step, real(8)
    !! @param[in]   vp_max   v_para velocity cut-off
    !! @param[in]   smu_max   v_perp velocity cut-off
    !! @param[in]   dvp   v_para grid spacing
    !! @param[in]   dsmu   v_perp grid spacing
    !! @param[in]   mype   MPI rank ID
    !!
    subroutine col_f_setup(isp,nsp,nmu,nvp,dt,vp_max,smu_max,dvp,dsmu,mype)
      implicit none
      integer, intent(in) :: isp, nsp, nmu, nvp, mype
      real (kind=8), intent(in) :: dt, vp_max, dvp, smu_max, dsmu
      !
      integer :: i, j
      integer :: mat_pos_rel(9), mat_pos_rel_indx(9), LU_i_arr(9)
      integer :: elem_n, mat_pos, LU_i, LU_j, incr_LU
      integer, allocatable, dimension(:) :: LU_colptr_num
    
      !!##### Multi-species >>> !! DEV_IMP
      col_f_sp_s = isp
      col_f_sp_e = nsp
      col_f_sp_num = col_f_sp_e - col_f_sp_s + 1
    
      col_f_i_nthreads = col_f_nthreads
      call set_omp_outer_thread_num( col_f_o_nthreads )
      if(mype .eq. 0) then
          write(*,'(a,i4)') '[MULTI-COL] inner thread = ', col_f_i_nthreads
          write(*,'(a,i4)') '[MULTI-COL] outer thread = ', col_f_o_nthreads
      endif

      col_f_nvr         = nmu+1
      col_f_nvrm1       = nmu
      col_f_nvz         = nvp*2 + 1
      col_f_nvzm1       = col_f_nvz-1
      col_f_ntotal_v    = col_f_nvr * col_f_nvz
      col_f_nvrm1_nvzm1 = col_f_nvrm1 * col_f_nvzm1
      col_f_dt          = dt ! delta time for collision operation
      col_f_vp_max      = vp_max
      col_f_smu_max     = smu_max
      col_f_dvp         = dvp
      col_f_dsmu        = dsmu

      ! 2013-02-23 =============================================== SUPER LU
      ! index_map_LU, LU_rowindx, LU_cvalues
      LU_n = col_f_ntotal_v !global
      LU_nnz = 4*4 + 6*2*(col_f_nvr-2)+6*2*(col_f_nvz-2)+9*(col_f_nvr-2)*(col_f_nvz-2) !global
      LU_nrhs = 1 !global
      LU_ldb = LU_n !global
      !$omp critical (alloc1)
      allocate(LU_rowindx(LU_nnz), LU_cvalues(LU_n), LU_colptr(LU_n+1), index_map_LU(9,LU_n))       !global
      allocate(LU_colptr_num(LU_n))    !local
      !$omp end critical (alloc1)

      LU_colptr_num = 0   ! number of elements in each column, local
      LU_rowindx = 0         ! global

      !below is time independent. Move to init_col in module
      LU_colptr(1) = 1
      do i=1,LU_n
          !for colptr
          LU_i = (i-1) / col_f_nvr+1
          LU_j = mod(i-1, col_f_nvr)+1
          if( (LU_i .eq. 1) .or. (LU_i .eq. col_f_nvz) ) then
              if( (LU_j .eq. 1) .or. (LU_j .eq. col_f_nvr) ) then
                  incr_LU = 4
              else
                  incr_LU = 6
              endif
          else
              if( (LU_j .eq. 1) .or. (LU_j .eq. col_f_nvr) ) then
                  incr_LU = 6
              else
                  incr_LU = 9
              endif
          endif
          LU_colptr(i+1) = LU_colptr(i)+incr_LU
      enddo

      !===============
      !  3--6--9
      !  |  |  |
      !  2--5--8
      !  |  |  |
      !  1--4--7
      !==============
      mat_pos_rel=(/-col_f_nvr-1,-col_f_nvr, -col_f_nvr+1, -1, 0, 1, col_f_nvr-1, col_f_nvr, col_f_nvr+1/)
      index_map_LU = 0
      do i=1,col_f_nvz
          do j=1, col_f_nvr
              mat_pos = j+(i-1)*col_f_nvr
      
              ! INDEXING
              if(i .eq. 1) then
                  if(j .eq. 1) then
                      !(J,I)=(1,1)
                      elem_n = 4
                      mat_pos_rel_indx(1:elem_n) =(/5,6,8,9/)
                   elseif (j .eq. col_f_nvr) then
                      !(J,I)=(Nr,1)
                      elem_n = 4
                      mat_pos_rel_indx(1:elem_n)=(/4,5,7,8/)
                   else
                      !(J,I)=(:,1)
                      elem_n = 6
                      mat_pos_rel_indx(1:elem_n)=(/4,5,6,7,8,9/)
                   endif
               elseif(i .eq. col_f_nvz) then
                   if(j .eq. 1) then
                      !(J,I)=(1,mesh_Nz)
                      elem_n = 4
                      mat_pos_rel_indx(1:elem_n)=(/2,3,5,6/)
                   elseif (j .eq. col_f_nvr) then
                      !(J,I)=(Nr,mesh_Nz)
                      elem_n = 4
                      mat_pos_rel_indx(1:elem_n)=(/1,2,4,5/)
                   else
                      !(J,I)=(:,mesh_Nz)
                      elem_n = 6
                      mat_pos_rel_indx(1:elem_n)=(/1,2,3,4,5,6/)
                   endif
               else
                   if(j .eq. 1) then
                      !(J,I) = (1,:)
                      elem_n = 6
                      mat_pos_rel_indx(1:elem_n)=(/2,3,5,6,8,9/)
                   elseif(j .eq. col_f_nvr) then
                      !(J,I) = (mesh_Nr,:)
                      elem_n = 6
                      mat_pos_rel_indx(1:elem_n)=(/1,2,4,5,7,8/)
                   else
                      !(J,I) = (:,:)
                      elem_n = 9
                      mat_pos_rel_indx(1:elem_n)=(/1,2,3,4,5,6,7,8,9/)
                   endif
               endif
               LU_i_arr(1:elem_n) = mat_pos+mat_pos_rel(mat_pos_rel_indx(1:elem_n))  ! I need to change LU_i to array
               index_map_LU(mat_pos_rel_indx(1:elem_n),mat_pos) = LU_colptr(LU_i_arr(1:elem_n))+LU_colptr_num(LU_i_arr(1:elem_n))
               LU_colptr_num(LU_i_arr(1:elem_n)) = LU_colptr_num(LU_i_arr(1:elem_n))+1
               LU_rowindx(index_map_LU(mat_pos_rel_indx(1:elem_n),mat_pos)) = mat_pos
               LU_cvalues(mat_pos) = index_map_LU(5, mat_pos)  !For implicit time marching
          enddo
      enddo
      !$omp critical (alloc1)
      deallocate(LU_colptr_num)
      !$omp end critical (alloc1)

      return

    end subroutine col_f_setup

    !> Deallocate global arrays of col_f_module
    subroutine col_f_finalize
      implicit none
      !$omp critical (alloc1)
      deallocate(LU_rowindx, LU_cvalues, LU_colptr, index_map_LU)
      !$omp end critical (alloc1)

      return

    end subroutine col_f_finalize

    !> Dummy routine for domain decomposition
    !> In full XGC, this would have some more logic
    subroutine get_mesh_node_range_for_this_mpirank(inode1_in, inode2_in, inode1, inode2, stride )
      implicit none
      integer, intent(in) :: inode1_in, inode2_in
      !
      integer :: inode1, inode2, stride

      inode1=inode1_in
      inode2=inode2_in
      stride = 1

      return

    end subroutine get_mesh_node_range_for_this_mpirank


    !> compute the number of threads used in the outer
    !! level OpenMP parallelization.
    !! The number of inner threads is set with an input
    !! parameter (col_f_nthreads)
    !! --> number of outer threads = OMP_NUM_THREADS/#(inner threads)
    !!
    subroutine set_omp_outer_thread_num( nthreads )
      use sml_module, only : sml_mype
#ifdef _OPENMP
      use omp_lib
#endif
      implicit none
      integer :: nthreads
      logical :: is_omp_nested
      character(len=255) :: str

#ifndef _OPENMP
      nthreads=1
#elif _OPENMP_OFFLOAD
      nthreads=1
#else

      ! ----------------------
      ! Note omp_get_nested() may not work correctly
      ! with mpixlf95_r on BG/Q Mira
      ! ----------------------
      nthreads = omp_get_max_threads()
      nthreads = max(1, nthreads/col_f_nthreads )
      is_omp_nested = .false.
      str = ''
      call getenv("OMP_NESTED",str)
      if (len(trim(str)) >= 1) then
        if ((trim(str).eq."TRUE").or. &
            (trim(str).eq."true").or. &
            (trim(str).eq."1")) then
           is_omp_nested = .true.
        endif
      endif

      if (is_omp_nested) then
        if (sml_mype == 0) then
          !$omp  master
          write(*,'(a,i4)') 'omp_get_nested() ',omp_get_nested()
          write(*,'(a,i4)') 'omp_get_max_theads() ', omp_get_max_threads()
          write(*,'(a,i4)') 'omp_get_num_theads() ', omp_get_num_threads()
          write(*,'(a,i4)') 'nthreads = ', nthreads
          !$omp  end master
        endif
      endif
#endif

      return

    end subroutine set_omp_outer_thread_num


    !> This routine decides how the workload is distributed
    !! between threads --> How many grid points for each thread
    subroutine get_mesh_node_range_for_threads_in_this_mpirank( inode1, inode2, stride,  &
                                              nthreads, isize, i_beg, i_end, i_stride )
      use omp_module, only : split_indices
      implicit none
      integer, intent(in) :: inode1, inode2, stride, nthreads
      integer :: isize, i_stride
      integer :: i_beg(size(col_f_mat_list)), i_end(size(col_f_mat_list))
      integer :: ith

#if defined(_OPENMP) && !defined(_OPENMP_OFFLOAD)
write(*,*) 'Running this code..'
      isize = min(inode2-inode1+1,size(col_f_mat_list),nthreads)
      if (isize .gt. 0) then
         call split_indices(inode2-inode1+1,isize,i_beg,i_end)
         i_beg(1:isize) = i_beg(1:isize) + (inode1-1)
         i_end(1:isize) = i_end(1:isize) + (inode1-1)
      else
         i_beg(:)=2
         i_end(:)=1
      endif
      i_stride = stride
#else
      isize = 1
      i_beg(1) = inode1
      i_end(1) = inode2
      i_stride = stride
#endif

      return

    end subroutine get_mesh_node_range_for_threads_in_this_mpirank


    !> Allocate memory for Landau interaction matrix and
    !! the advection and diffusion operators
    !! This may be a lot of memory, especially for
    !! cases with multiple particle species. Therefore, they
    !! are allocated and deallocated with every call to the
    !! collision routine.
    !!
    !! @param[in]  isize   Dynamic memory size
    !!
    subroutine init_col_f_module_dynamic(isize)
      implicit none
      integer, intent(in) :: isize
      integer :: alloc_stat
      integer :: isp, ithread
    
      !!##### M_s, M_ab
      allocate(M_s( col_f_nvr-1, 5, (col_f_nvr-1)*(col_f_nvz-1), &
                    col_f_sp_s:col_f_sp_e, &
                    isize ), stat=alloc_stat)
#ifdef _OPENACC
!$acc enter data pcreate(M_s)
#elif _OPENMP_OFFLOAD
!$omp target enter data map(alloc:M_s)
#endif
      if(col_f_sp_num .ge. 2) then
         if(allocated(M_ab)) print *, 'BUG found. memory is allocated already'
         allocate(M_ab( (col_f_nvr-1)*(col_f_nvz-1), 3, (col_f_nvr-1)*(col_f_nvz-1), &
                         col_f_sp_s:col_f_sp_e-1, col_f_sp_s:col_f_sp_e, &
                         isize ), stat=alloc_stat)
#ifdef _OPENACC
!$acc enter data pcreate(M_ab)
#elif _OPENMP_OFFLOAD
!$omp target enter data map(alloc:M_ab)
#endif
      endif
write(*,*) 'shape(M_ab) = ', shape(M_ab)
      !!##### col_spall
      allocate(col_sp_cell_all(col_f_sp_s:col_f_sp_e, isize), stat=alloc_stat)
write(*,*) 'shape(col_sp_cell_all) = ', shape(col_sp_cell_all)

      !!##### gammac_spall
      allocate(gammac_spall(col_f_sp_s:col_f_sp_e,col_f_sp_s:col_f_sp_e, isize), stat=alloc_stat)
write(*,*) 'shape(gammac_spall) = ', shape(gammac_spall)

      !!##### mesh_r, mesh_z, mesh_r_half, mesh_z_half, local_center_voume, pdf_n, pdf_np1, vol, delta_r, delta_z, ED
      do ithread=1,isize
         do isp=col_f_sp_s,col_f_sp_e
             allocate(col_sp_cell_all(isp,ithread)%mesh_r(col_f_nvr), &
                      col_sp_cell_all(isp,ithread)%mesh_z(col_f_nvz), &
                      col_sp_cell_all(isp,ithread)%mesh_r_half(col_f_nvr-1), &
                      col_sp_cell_all(isp,ithread)%mesh_z_half(col_f_nvz-1), &
                      col_sp_cell_all(isp,ithread)%local_center_volume(col_f_nvr-1), &
                      col_sp_cell_all(isp,ithread)%pdf_n(col_f_nvr, col_f_nvz), &
                      col_sp_cell_all(isp,ithread)%pdf_np1(col_f_nvr, col_f_nvz), &
                      col_sp_cell_all(isp,ithread)%vol(col_f_nvr), &
                      col_sp_cell_all(isp,ithread)%delta_r(col_f_nvr-1,col_f_sp_s:col_f_sp_e), &
                      col_sp_cell_all(isp,ithread)%delta_z(col_f_nvz-1,col_f_sp_s:col_f_sp_e), &
                      col_sp_cell_all(isp,ithread)%ED(5, col_f_nvr-1, col_f_nvz-1), stat=alloc_stat)
         enddo
      enddo

      return

    end subroutine init_col_f_module_dynamic


    !> Deallocate memory that is no longer needed after
    !! completion of the collision calculation
    !!
    !! @param[in]   isize   Dynamic memory size
    subroutine finalize_col_f_module_dynamic( isize )
      implicit none
      integer, intent(in) :: isize
      integer :: ithread, i
      integer :: alloc_stat
     
      deallocate(gammac_spall, stat=alloc_stat)

      do ithread=1,isize
         do i=col_f_sp_s,col_f_sp_e
            deallocate(col_sp_cell_all(i,ithread)%mesh_r,      col_sp_cell_all(i,ithread)%mesh_z,      &
                       col_sp_cell_all(i,ithread)%mesh_r_half, col_sp_cell_all(i,ithread)%mesh_z_half, &
                       col_sp_cell_all(i,ithread)%local_center_volume, &
                       col_sp_cell_all(i,ithread)%vol, &
                       col_sp_cell_all(i,ithread)%pdf_n,   col_sp_cell_all(i,ithread)%pdf_np1, &
                       col_sp_cell_all(i,ithread)%delta_r, col_sp_cell_all(i,ithread)%delta_z, &
                       col_sp_cell_all(i,ithread)%ED, stat=alloc_stat)
         enddo
      enddo
      deallocate(col_sp_cell_all, stat=alloc_stat)
      deallocate(gammac_spall, stat=alloc_stat)

      deallocate(M_s, stat=alloc_stat)
#ifdef _OPENACC
!$acc  exit data delete(M_s)
#elif _OPENMP_OFFLOAD
!$omp target exit data map(release:M_s)
#endif
      if(col_f_sp_num .gt. 1) then
         deallocate(M_ab, stat=alloc_stat)
#ifdef _OPENACC
!$acc exit data delete(M_ab)
#elif _OPENMP_OFFLOAD
!$omp target exit data map(release:M_ab)
#endif
      endif

      return

    end subroutine finalize_col_f_module_dynamic


    !> Convert the distribution function to the units used
    !! internally by the collision operator
    !! The distribution function set up with f0_module is in normalized velocity space
    !! whereas the collision operator uses SI units.
    !!
    subroutine setup_col_sp(f_in,inode1_in, inode2_in, inode, mass_in, t_ev_in,  &
                            den_in,charge_in, col_spall, gammac)
      use sml_module, only: sml_ev2j, sml_2pi, sml_pi, sml_e_charge, sml_prot_mass
      implicit none
      integer, intent(in) :: inode1_in, inode2_in
      real (kind=8), intent(in) :: f_in(-col_f_nvzm1/2:col_f_nvzm1/2,inode1_in:inode2_in,  &
                                        0:col_f_nvrm1,col_f_sp_s:col_f_sp_e)
      real (kind=8), dimension(col_f_sp_s:col_f_sp_e) :: mass_in, t_ev_in, charge_in, den_in
      integer, intent(in) :: inode
      type(col_f_sp_type), intent(inout) :: col_spall(col_f_sp_s:col_f_sp_e)
      real (kind=8), intent(inout) :: gammac(col_f_sp_s:col_f_sp_e, col_f_sp_s:col_f_sp_e)
      !
      real (kind=8) :: mass, mesh_dz, mesh_dr, vth, smu_n, pi4bb0vth3_dd,  &
                       t_ev, den, charge, conv_factor
      integer :: isp, j, imu, ir, iz


      !! %PARAMETER SETTINGS BASED ON USER INPUT%
      do isp=col_f_sp_s,col_f_sp_e

        col_spall(isp)%spid        = isp    !! this should be first for identification in any routine
        col_spall(isp)%nodeid      = inode  !! mainly for diagnosis in col_fm_core (redundant paramter in some sense)

        den    = den_in(isp)
        t_ev   = t_ev_in(isp)
        mass   = mass_in(isp)
        charge = charge_in(isp)

        conv_factor=1.D0/sqrt(t_ev*(sml_2pi * sml_e_charge / mass)**3)
        col_spall(isp)%conv_factor = conv_factor

        do imu=0, col_f_nvrm1
          if(imu==0) then
             smu_n=col_f_dsmu/3D0
          else
             smu_n=col_f_dsmu*real(imu,8)
          endif

          ! Local f with basic correction:
          ! Simply cut off all negative values
          col_spall(isp)%pdf_n(imu+1,:)=max(f_in(:,inode,imu,isp),0.D0)*conv_factor/smu_n
        enddo

        !! pdf_np1 = pdf_n
        do iz=1, col_f_nvz
          do ir=1, col_f_nvr
            col_spall(isp)%pdf_np1(ir,iz) = col_spall(isp)%pdf_n(ir,iz)
          enddo
        enddo

        !! vol
        vth=sqrt(t_ev*sml_ev2j/mass)
        pi4bb0vth3_dd=sml_2pi*vth*vth*vth*col_f_dsmu*col_f_dvp

        !! --- 0th component
        smu_n=col_f_dsmu/3D0
        col_spall(isp)%vol(1) = 0.5D0*pi4bb0vth3_dd*smu_n
        !! --- 1st to (last-1)
        do imu=1, col_f_nvrm1-1
           smu_n=col_f_dsmu*real(imu,8)
           col_spall(isp)%vol(imu+1) = pi4bb0vth3_dd*smu_n
        enddo
        !! --- last component
        smu_n=col_f_dsmu*(real(col_f_nvrm1,8)-1D0/3D0) !rh imu or f0_nmu???
        col_spall(isp)%vol(col_f_nvr)=0.5D0*pi4bb0vth3_dd*smu_n

        !!vth_par  = sqrt(sp_t_par(i)  * sml_e_charge / mass)
        !!vth_perp = sqrt(sp_t_perp(i) * sml_e_charge / mass)
        mesh_dz = col_f_dvp*vth
        mesh_dr = col_f_dsmu*vth

        col_spall(isp)%T_avg            = t_ev
        col_spall(isp)%den_lambda_gamma = den
        col_spall(isp)%mass_au          = mass/sml_prot_mass
        col_spall(isp)%mass             = mass
        col_spall(isp)%charge_eu        = charge/sml_e_charge

        !! < Mesh-related quantities>
        col_spall(isp)%vpar_beg         = -col_f_vp_max*vth  !! (=dlx)
        col_spall(isp)%mesh_dz          = mesh_dz      !! (=mesh_dz)
        col_spall(isp)%mesh_dr          = mesh_dr     !! (=mesh_dr)


        ! mesh_r, mesh_r_half, mesh_z, mesh_z_half
        do j=1, col_f_nvr-1
          col_spall(isp)%mesh_r(j)       = mesh_dr*(j-1)
          col_spall(isp)%mesh_r_half(j)  = mesh_dr*(j-0.5D0)
        end do
        col_spall(isp)%mesh_r(col_f_nvr)   = mesh_dr*(col_f_nvr-1)
        do j=1, col_f_nvz-1
          col_spall(isp)%mesh_z(j)       = col_spall(isp)%vpar_beg + mesh_dz*(j-1)
          col_spall(isp)%mesh_z_half(j)  = col_spall(isp)%vpar_beg + mesh_dz*(j-0.5D0)
        end do
        col_spall(isp)%mesh_z(col_f_nvz)   = col_spall(isp)%vpar_beg + mesh_dz*(col_f_nvz-1)
        !! local_center_volume (mesh_r_half, mesh_dr, mesh_dz)
        !! : volume centered at a cell
        col_spall(isp)%local_center_volume = col_spall(isp)%mesh_r_half*mesh_dr*mesh_dz

      enddo !isp

      !gamma
      do isp=col_f_sp_s, col_f_sp_e
         do j=col_f_sp_s, col_f_sp_e
            call col_f_lambda_gamma_pair(col_spall(isp), col_spall(j), gammac(j,isp))  !! C(i->j)
         enddo !j
      enddo

      return

    end subroutine setup_col_sp


    !> Computes the base collision frequency -- Eq. (6) in Hager et al.
    !!
    subroutine col_f_lambda_gamma_pair(sp_a, sp_b, gammac_loc)  !! C(a->b)
      use sml_module, only : sml_e_charge, sml_mype, sml_istep, sml_pi
      implicit none
      type(col_f_sp_type) :: sp_a, sp_b
      real (kind=8) :: gammac_loc
      !
      real (8) :: lambda, ti_ev, massi, densi, chargei, te_ev, masse, dense
      real (8) :: tmpr
      logical :: e_in, e_col, e_tar

      !! check if electron is in
      e_col = sp_a%spid .eq. 0
      e_tar = sp_b%spid .eq. 0
      e_in  = e_col .or. e_tar

      ! NRL Plasma Formulary 2011 version, p.34
      !(c) Mixed ion-ion collisions (here, same species ion-ion collisions)
      if(e_in) then
         !if electron is invovled
           if( e_col .and. e_tar ) then
              !(a) Thermal electron-electron collisions
              ! Note that pointers for colliding and target are same.
              lambda = 2.35D1 - log(sqrt(sp_a%den_lambda_gamma*1D-6)*(sp_a%T_avg**(-1.25D0)))  &
                              - sqrt(abs(1D-5+((log(sp_a%T_avg) -2D0)**2)/16D0))
              gammac_loc = (sml_e_charge**4) * lambda / (sp_a%mass*((8.8542D-12)**2) * 8D0 * sml_pi)
           else
              if(e_col) then
                 ti_ev   = sp_b%T_avg
                 massi   = sp_b%mass_au
                 densi   = sp_b%den_lambda_gamma
                 chargei = sp_b%charge_eu
                 te_ev   = sp_a%T_avg
                 masse   = sp_a%mass_au
                 dense   = sp_a%den_lambda_gamma
              else
                 te_ev   = sp_b%T_avg
                 masse   = sp_b%mass_au
                 dense   = sp_b%den_lambda_gamma
                 ti_ev   = sp_a%T_avg
                 massi   = sp_a%mass_au
                 densi   = sp_a%den_lambda_gamma
                 chargei = sp_a%charge_eu
              endif
              !(b) Electron-ion (and ion-electron) collisions
              if(ti_ev * masse/massi .lt. te_ev) then
                 if(te_ev .lt. 1D1*(chargei**2)) then
                    lambda = 2.3D1 - log(chargei*sqrt(dense*1D-6/(te_ev**3)))
                 else
                    lambda = 2.4D1 - log(sqrt(dense*1D-6)/te_ev)
                 endif
              else
                 lambda = 3D1 - log((chargei**2)*sqrt(densi*1D-6/(ti_ev**3))/massi)
              endif
      
              tmpr = (sml_e_charge**4) * (chargei**2) * lambda /( ((8.8542D-12)**2) * 8D0 * sml_pi )
              gammac_loc = tmpr / sp_a%mass ! colliding : a, target : b
           endif
      else
         lambda = 2.3D1 - log( sp_a%charge_eu * sp_b%charge_eu * (sp_a%mass_au + sp_b%mass_au) &
                                  / (sp_a%mass_au*sp_b%T_avg + sp_b%mass_au*sp_a%T_avg) &
                                  * sqrt( sp_a%den_lambda_gamma*1D-6*(sp_a%charge_eu**2)/sp_a%T_avg &
                                        + sp_b%den_lambda_gamma*1D-6*(sp_b%charge_eu**2)/sp_b%T_avg) )
         tmpr = (sml_e_charge**4) * (sp_a%charge_eu**2) * (sp_b%charge_eu**2) * lambda /( ((8.8542D-12)**2) * 8D0 * sml_pi )
         gammac_loc = tmpr / sp_a%mass   ! colliding : a, target : b
      endif

      gammac_loc = gammac_loc * col_f_dt

    end subroutine col_f_lambda_gamma_pair


    !> Top-level collision routine
    !! This routine performs the loop over configuration space grid points with
    !! OpenMP parallelization --> "Outer level" parallelism.
    !!
    subroutine fm_collision(f_in,df_out,inode1_in,inode2_in,nthreads,den_in,t_ev_in,  &
                            mass_in, charge_in)
      use sml_module, only: sml_mype
#ifdef _OPENMP
      use omp_lib
#endif
      !use mpi
      implicit none
      !
      integer, intent(in) :: inode1_in, inode2_in, nthreads
      real (kind=8), intent(in) :: f_in(-col_f_nvzm1/2:col_f_nvzm1/2,inode1_in:inode2_in,  &
                                        0:col_f_nvrm1,col_f_sp_s:col_f_sp_e)
      real (kind=8), intent(out) :: df_out(-col_f_nvzm1/2:col_f_nvzm1/2,inode1_in:inode2_in,  &
                                           0:col_f_nvrm1,col_f_sp_s:col_f_sp_e)
      real (kind=8), intent(in), dimension(col_f_sp_s:col_f_sp_e) :: den_in, t_ev_in, mass_in, charge_in
      !
      integer :: alloc_stat
      integer :: inode1, inode2, stride, isize, i_stride
      integer :: i_beg(size(col_f_mat_list)), i_end(size(col_f_mat_list))
      integer :: ith, node, isp, imu
      integer :: jsize, ierr
      logical :: update_ok

      df_out(:,:,:,:) = 0D0

      call get_mesh_node_range_for_this_mpirank(inode1_in, inode2_in, inode1, inode2, stride)
      call get_mesh_node_range_for_threads_in_this_mpirank ( inode1, inode2, stride,  &
                                        nthreads, isize, i_beg, i_end, i_stride )
write(*,*) 'init_col_f_module_dynamic starting...'
      call init_col_f_module_dynamic( isize )   !! allocating memory for M_s (and M_ss)
write(*,*) 'init_col_f_module_dynamic finished...'
      !$omp parallel default (none)                                          &
      !$omp shared(isize, i_beg, i_end, i_stride,  &
      !$omp        col_sp_cell_all, col_f_mat_list, col_f_ksp_list, col_f_vecb_list,  &
      !$omp        col_f_vecx_list, col_f_sp_num, gammac_spall, M_s, M_ab,            &
      !$omp        col_f_sp_s, col_f_sp_e, col_f_nvrm1, sml_mype, f_in, inode1_in,    &
      !$omp        inode2_in, mass_in, den_in, charge_in, t_ev_in,df_out)             &
      !$omp private(ith, node, update_ok, isp, imu) num_threads(col_f_o_nthreads)
      !$omp do
      do ith=1,isize   !! isize = outer thread num?????
        do node=i_beg(ith),i_end(ith),i_stride

        call setup_col_sp( f_in, inode1_in, inode2_in, node, mass_in, t_ev_in, den_in,  &
                           charge_in, col_sp_cell_all(:,ith), gammac_spall(:,:,ith)     )

        !!##### TIME ADVANCE
        if(col_f_sp_num .eq. 1) then          !!### SINGLE-SPECIES COLLISION
           call col_fm_core(col_sp_cell_all(:,ith), gammac_spall(:,:,ith), update_ok, &
                           col_f_mat_list(ith), col_f_ksp_list(ith),col_f_vecb_list(ith), col_f_vecx_list(ith), &
                           M_s(:,:,:,:,ith))
        else                                  !!### MULTI-SPECIES COLLISION
           call col_fm_core(col_sp_cell_all(:,ith), gammac_spall(:,:,ith), update_ok, &
                           col_f_mat_list(ith), col_f_ksp_list(ith),col_f_vecb_list(ith), col_f_vecx_list(ith), &
                           M_s(:,:,:,:,ith), M_ab(:,:,:,:,:,ith))
        endif

        if(update_ok) then
            do isp = col_f_sp_s, col_f_sp_e
                do imu=0, col_f_nvrm1
                    df_out(:,node,imu,isp) = col_sp_cell_all(isp,ith)%pdf_np1(imu+1,:)  !! at the end of col_fm_core, this is "df" we need
                enddo
            enddo
        endif
      enddo
    enddo
!$omp end do
!$acc wait
!$omp end parallel

!$acc wait
write(*,*) 'finalize_col_f_module_dynamic starting...'
      call finalize_col_f_module_dynamic( isize )
write(*,*) 'finalize_col_f_module_dynamic finished...'

!rh unnecessary
!#ifdef _OPENMP
!      !  ---------------------
!      !  reset omp_num_threads
!      !  ---------------------
!      nthreads = omp_get_max_threads()
!      call omp_set_num_threads( nthreads )
!#endif

    end subroutine fm_collision


    !> This routine solves one collision problem (i.e. one backward Euler
    !! time step of df/dt=C(f)) on a 2D velocity space grid.
    !! The backward Euler equation is solved with LU factorization and a
    !! LAPACK band solver (dgbsv --> bsolver.F90).
    !! For details of the backward Euler time discretization --> Eq. (27) in Hager et al.
    !! OpenMP loops starting in this routine and down the call tree belong to the 
    !! "inner level" parallelism.
    !!
    subroutine col_fm_core( col_spall, gammac, update_ok, &
                           col_f_mat, col_f_ksp, col_f_vecb, col_f_vecx, &
                           M_s, M_ab )
      use sml_module, only: sml_mype
      implicit none
      integer :: col_f_mat
      integer :: col_f_ksp
      integer :: col_f_vecb
      integer :: col_f_vecx
      !
      type(col_f_sp_type), dimension(col_f_sp_s:col_f_sp_e) :: col_spall
      real(kind=8), dimension(col_f_sp_s:col_f_sp_e, col_f_sp_s:col_f_sp_e) :: gammac
      logical :: update_ok
      real (kind=8) :: M_s( col_f_nvrm1, 5, col_f_nvrm1_nvzm1,col_f_sp_s:col_f_sp_e )
      real (kind=8), optional :: M_ab( col_f_nvrm1_nvzm1, 3, col_f_nvrm1_nvzm1, &
                                        col_f_sp_s:col_f_sp_e-1, col_f_sp_s:col_f_sp_e )
      real (kind=8), dimension(col_f_nvr, col_f_nvz) :: df   ! local
      real (kind=8), dimension(col_f_nvr, col_f_nvz) :: df_corr   ! local
      real (kind=8), dimension(col_f_ntotal_v, col_f_sp_s:col_f_sp_e) :: dist_col
      real (kind=8) :: negative_count
      real (kind=8),dimension(col_f_nvrm1,col_f_nvzm1) :: fhalf,dfdr,dfdz
      real (kind=8), dimension(5,col_f_nvrm1,col_f_nvzm1) :: ED
      integer :: iter_inter, spi, spj, spj_mod
      real (kind=8) :: col_dw_sum, col_dp_sum, col_w_sum, col_p_sum
      real (kind=8) :: col_dw, col_dp, col_dn_n, col_dn_n_max
      real (kind=8), dimension(LU_nnz, col_f_sp_s:col_f_sp_e) :: LU_values ! Super LU Variables
      real (kind=8), dimension(LU_nnz) :: LU_values_tmp ! Super LU Variables
      integer :: index_1,index_2,index_0, ir
      real (kind=8) :: smu_n
      logical :: dens_exit_ok, en_exit_ok, mom_exit_ok
      real (kind=8) :: min_p_thres
      integer :: index_I, index_J, index_c
      logical, external :: is_nan
#ifdef _OPENACC
      logical :: pM_ab
      integer :: ithread,istream
      !integer, external :: omp_get_thread_num

      pM_ab = present(M_ab)
      ithread = 0
      !ithread = omp_get_thread_num()
      istream = ithread + 1
#endif

      update_ok = .false.   !!just for the case where sudden returning during calculation

      !! ## ----- INITIALIZATION
      col_w_sum = 0D0   !! sum of energy over species
      col_p_sum = 0D0   !! sum of momentum over species
      min_p_thres=1D99  !! momentum error criterion; just large value to be reinitialized with a small value

      do spi=col_f_sp_s, col_f_sp_e
         call col_fm_core_init(col_spall(spi))  !! evaluate col_f_sp_type%numeric_vth2, numeric_T, dens, ens, mom from " col_f_sp_type%pdf_n "
         col_w_sum = col_w_sum + col_spall(spi)%ens
         col_p_sum = col_p_sum + col_spall(spi)%mom
         min_p_thres=min(col_spall(spi)%mass*col_spall(spi)%dens  &
                          * sqrt(col_spall(spi)%numeric_vth2) , min_p_thres)
      enddo !! spi

      !rh Calculate finite difference parameters
      do spi=col_f_sp_s, col_f_sp_e
         do spj=col_f_sp_s, col_f_sp_e
            call col_fm_core_delta_init(col_spall(spi), col_spall(spj))  !! quasi-equilibrium parameter
         enddo
      enddo

write(*,*) 'minval(M_s) = ', minval(M_s)
write(*,*) 'maxval(M_s) = ', maxval(M_s)
write(*,*) 'minval(M_ab) = ', minval(M_ab)
write(*,*) 'maxval(M_ab) = ', maxval(M_ab)
      do spi=col_f_sp_s, col_f_sp_e
         do spj=col_f_sp_s, col_f_sp_e
            if(spi .eq. spj) then
write(*,*) 'col_fm_angle_avg_s starting...'
               call col_fm_angle_avg_s(col_spall(spi), M_s(:,:,:,spi))  !! C(spa,spa)
write(*,*) 'col_fm_angle_avg_s finished...'
            else
               if(spj .gt. spi) then
                  spj_mod = spj-1
               else
                  spj_mod = spj
               endif
write(*,*) 'col_fm_angle_avg_ab starting...'
!write(*,*) 'spi = ', spi
!write(*,*) 'spj = ', spj
!write(*,*) 'spj_mod = ', spj_mod
write(*,*) 'shape(col_spall) = ', shape(col_spall)
               call col_fm_angle_avg_ab(col_spall(spi), col_spall(spj), M_ab(:,:,:,spj_mod,spi)) !! C(spi->spj)
write(*,*) 'col_fm_angle_avg_ab finished...'
            endif
         enddo
      enddo
write(*,*) 'minval(M_s) = ', minval(M_s)
write(*,*) 'maxval(M_s) = ', maxval(M_s)
write(*,*) 'minval(M_ab) = ', minval(M_ab)
write(*,*) 'maxval(M_ab) = ', maxval(M_ab)
!stop
!write(*,*) 'shape(M_ab) = ', shape(M_ab)
!open(unit = 1, file="M_ab.txt")
!write(1,*) 'M_ab = ', M_ab
!close(1)
!stop



      !! "dist_iter" initializtion (making it zero) has been moved to initialization at make_initial_pdf_bimaxwell
      !! dist_iter <-implicitly updated distribution  (2D)

      !! ## ----- IMPLICIT TIME ADVANCE LOOP
      !!    NOTE THAT "dist_iter" is the PDF iterated and being updated in this LOOP
      !!    dist_iter -> col_f_sp_type%pdf_np1
!write(*,*) 'vpic_inner_iter_max = ', vpic_inner_iter_max
      do iter_inter=1, vpic_inner_iter_max
write(*,*) 'iter_inter = ', iter_inter

        !! ##  b (=dist_col) = pdf_n; Ax=b
        !$omp  parallel do default(none)                            &
        !$omp& shared(dist_col,col_spall)                           &
        !$omp& shared(col_f_sp_s, col_f_sp_e, col_f_nvr, col_f_nvz) &
        !$omp& private(index_1,index_2,index_0,spi)                 &
        !$omp& num_threads(col_f_i_nthreads)
        do spi=col_f_sp_s, col_f_sp_e
           do index_2=1,col_f_nvz
             do index_1=1,col_f_nvr
               index_0 = index_1 + (index_2-1)*col_f_nvr
               dist_col(index_0,spi) = col_spall(spi)%pdf_n(index_1,index_2)   !! keep pdf_n for convergence calc. dist_col = pdf_n for matrix calc.
             enddo !index_1
           enddo !index_2
        enddo !spi

        !! ### ----- LU_values (which should be zero at the beginning of this sum)
        LU_values = 0D0
write(*,*) 'sum(LU_values) = ', sum(LU_values)
        do spi=col_f_sp_s, col_f_sp_e
           do spj=col_f_sp_s, col_f_sp_e
              call col_fm_f_df(col_spall(spj), spi, fhalf, dfdr, dfdz)  !! fhalf, dfdr, dfdz for col_spall(target sp) based on "pdf_np1"
                                    !! For the 1st step, pdf_np1 is already initialized to have same values with pdf_n at [setup_col_sp]
              ! EDs = 1: Drr, 2: Drz, 3:Dzz, 4:Dzr, 5: Er, 6:Ez
              if(spi .eq. spj) then
write(*,*) 'col_fm_E_and_D_s starting...'
                 call col_fm_E_and_D_s(col_spall(spi)%mass, fhalf, dfdr, dfdz, M_s(:,:,:,spi), ED) ! i-i
write(*,*) 'col_fm_E_and_D_s finished...'
              else
                 if(spj .gt. spi) then
                    spj_mod = spj-1
                 else
                    spj_mod = spj
                 endif !spj .gt. spi
write(*,*) 'col_fm_E_and_D_ab starting...'
                 call col_fm_E_and_D_ab(col_spall(spi), col_spall(spj), fhalf, dfdr, dfdz, M_ab(:,:,:,spj_mod,spi), ED)
write(*,*) 'col_fm_E_and_D_ab finished...'
              endif !spi .eq. spj

              call col_f_LU_matrix(spj, col_spall(spi), ED, LU_values_tmp)  !! use original
              LU_values(:,spi) = LU_values(:,spi) + LU_values_tmp*gammac(spj,spi)
!write(*,*) 'gammac(spj,spi) = ', gammac(spj,spi)
!write(*,*) 'LU_values_tmp = ', LU_values_tmp
!write(*,*) 'shape(LU_values(:,spi)) = ', shape(LU_values(:,spi))
           enddo !spj
        enddo !spi
write(*,*) 'sum(LU_values) = ', sum(LU_values)
!stop
write(*,*) 'LU_nnz = ', LU_nnz
write(*,*) 'maxval(LU_values(:,1)) = ', maxval(LU_values(:,1))
write(*,*) 'minval(LU_values(:,1)) = ', minval(LU_values(:,1))
!$omp barrier
        !! ### ----- Time advance & Exit condition check
        col_dw_sum = 0D0  !! sum of energy change over species (i.e. error in energy)
        col_dp_sum = 0D0  !! sum of momentum change over species (i.e. error in momentum)
        col_dn_n_max = 0D0 !! maximum fraction of density changes among species (i.e. maximum relative error in density in all species )
        dens_exit_ok = .true.
        do spi=col_f_sp_s, col_f_sp_e
           !call col_f_picard_step(iter_inter, LU_values(:,spi), dist_col(:,spi), col_spall(spi)%pdf_np1, &
           !      col_f_mat, col_f_ksp, col_f_vecb, col_f_vecx)
!write(*,*) 'iter_inter = ', iter_inter
write(*,*) 'shape(LU_values) = ', shape(LU_values)
write(*,*) 'shape(LU_values(:,spi)) = ', shape(LU_values(:,spi))
write(*,*) 'sum(LU_values(:,spi)) = ', sum(LU_values(:,spi)), spi
!write(*,*) 'LU_values(:,spi) = ', LU_values(:,spi)
write(*,*) 'shape(dist_col(:,spi)) = ', shape(dist_col(:,spi))
write(*,*) 'sum(dist_col(:,spi)) = ', sum(dist_col(:,spi))
!write(*,*) 'dist_col(:,spi) = ', dist_col(:,spi)
write(*,*) 'shape(col_spall(spi)%pdf_np1) = ', shape(col_spall(spi)%pdf_np1)
write(*,*) 'sum(col_spall(spi)%pdf_np1) = ', sum(col_spall(spi)%pdf_np1)
!write(*,*) 'col_spall(spi)%pdf_np1 = ', col_spall(spi)%pdf_np1
           call col_fm_picard_step(iter_inter, LU_values(:,spi), dist_col(:,spi), col_spall(spi)%pdf_np1)
!write(*,*) 'col_dn_n = ', col_dn_n, spi
!write(*,*) 'col_dp = ', col_dp, spi
!write(*,*) 'col_dw = ', col_dw, spi
           call col_fm_convergence_eval(col_spall(spi), col_dw, col_dp, col_dn_n)  !! moments evalulation from difference betw. pdf_n and pdf_np1
           col_dw_sum = col_dw_sum + col_dw
           col_dp_sum = col_dp_sum + col_dp
!write(*,*) 'col_dw_sum = ', col_dw_sum, spi
!write(*,*) 'col_dp_sum = ', col_dp_sum
           if(col_dn_n_max .lt. col_dn_n) col_dn_n_max = col_dn_n
           dens_exit_ok = dens_exit_ok .and. (col_dn_n .lt. 1D-6)
        enddo !spi

        en_exit_ok = dabs(col_dw_sum/col_w_sum) .le. 1D-6
write(*,*) 'dabs(col_dw_sum/col_w_sum) = ', dabs(col_dw_sum/col_w_sum)
!.true.
        mom_exit_ok = dabs(col_dp_sum)/(max(dabs(col_p_sum),min_p_thres)) .le. (col_f_vp_max/col_f_nvz)   !! v_par = max_v_par of simulation domain / vth
!write(*,*) 'en_exit_ok = ', en_exit_ok
!write(*,*) 'col_dw_sum = ', col_dw_sum
!write(*,*) 'col_w_sum = ', col_w_sum
!write(*,*) 'mom_exit_ok = ', mom_exit_ok
        if( dens_exit_ok .and. en_exit_ok  .and. mom_exit_ok .and. iter_inter .ne. 1) then    !! Why did we set a condition for iter_inter?
            ! Accuracy is enough to go
            exit
        else
           !if( iter_inter .ne. 1) then
           if( iter_inter .gt. vpic_inner_iter_max-2) then
!write(*,*) 'iter_inter = ', iter_inter
!write(*,*) 'vpic_inner_iter_max = ', vpic_inner_iter_max
#if !defined(_OPENMP) && !defined(_OPENACC)
              ! Print and write can cause problems with OpenMP and
              ! possibly OpenACC
              write(*,'(a)') 'Not converged because:'
              write(*,'(a,l,e22.12,a)') 'exit condition: dens', dens_exit_ok, col_dn_n, '/1D-6'
              write(*,'(a,l,e22.12,a,2(e22.12,1x))') 'exit condition: energy',   &
                      (dabs(col_dw_sum/col_w_sum) .le. 1D-6 ),   &
                      col_dw_sum/col_w_sum, '/1D-6 :', col_dw_sum, col_w_sum
              write(*,'(a,l,3(e22.12,1x),a,e22.12)') 'exit condition: mom',  &
                      (dabs(col_dp_sum)/(max(dabs(col_p_sum),min_p_thres)) .le. (col_f_vp_max/col_f_nvz)),  &
                      col_dp_sum, col_p_sum, min_p_thres, '/',(col_f_vp_max/col_f_nvz)
              write(*,'(a,i4)') 'exit condition: iteration number', iter_inter
#endif
           else if( .not. (dens_exit_ok .and. en_exit_ok .and. mom_exit_ok)  &
                    .and. iter_inter==1 ) then
!write(*,*) 'dens_exit_ok = ', dens_exit_ok
!write(*,*) 'en_exit_ok = ', en_exit_ok
!write(*,*) 'mom_exit_ok = ', mom_exit_ok
!write(*,*) 'iter_inter = ', iter_inter
#if !defined(_OPENMP) && !defined(_OPENACC)
              write(*,'(a)') 'conservation mistmatch! i.e. numerical model is implemented in a wrong way.  &
                            & please check gammac value and conservation terms'
              write(*,'(a,3(l,1x))') 'dens, en, mom logical:', dens_exit_ok, en_exit_ok, mom_exit_ok
              write(*,'(3(e22.12,a,1x))') col_dn_n,'/1D-6', col_dw_sum/col_w_sum, '/1D-6', dabs(col_dp_sum)  &
                       /(max(dabs(col_p_sum),min_p_thres)),'/', (col_f_vp_max/col_f_nvz)
#endif
              do spi=col_f_sp_s,col_f_sp_e
                 do spj=col_f_sp_s,col_f_sp_e
                    print *, spi, spj, gammac(spj,spi)*col_spall(spi)%mass, gammac(spi,spj)*col_spall(spj)%mass
                 enddo !spj
              enddo !spi
              stop
              return  !! no update since update_ok is still false at this point - code should be fixed first before use
           endif !iter_inter .gt. vpic_inner_iter_max-2
        endif !dens_exit_ok .and. en_exit_ok  .and. mom_exit_ok .and. iter_inter .ne. 1

              do spi=col_f_sp_s,col_f_sp_e
                 do spj=col_f_sp_s,col_f_sp_e
                    print *, spi, spj, gammac(spj,spi)*col_spall(spi)%mass, gammac(spi,spj)*col_spall(spj)%mass
                 enddo
              enddo
      enddo !iter_inter   !! ### ----- implicit iteration loop ends here

      !! ### ----- DISTRIBUTION UPDATE (start)
      update_ok = .true.  !! Now check all fail cases. Other than that, it shold be updated

      if (iter_inter .ge. vpic_inner_iter_max) then
#if !defined(_OPENMP) && !defined(_OPENACC)
         write(*,'(a,2(i8,1x))') 'inner iteration went to maximum number. All pdfs are NOT updated: ' //  &
                   ' mype, node = ', sml_mype, col_spall(col_f_sp_s)%nodeid
#endif
         update_ok= .false.
      else
         do spi=col_f_sp_s, col_f_sp_e
            ! Prevent negative values in new distribution function
            ! Heaviside function
            !$omp parallel do private(index_1,index_2) num_threads(col_f_i_nthreads)
            do index_2=1,size(df_corr,2)
               do index_1=1,size(df_corr,1)
                 df_corr(index_1,index_2)=0.5D0*(sign(1D0,col_spall(spi)%pdf_np1(index_1,index_2))+1D0)
               enddo !index_1
            enddo !index_2
            negative_count=real(col_f_nvr*col_f_nvz,8) - sum(df_corr)

           if (negative_count .gt. 0.3D0*real(col_f_nvr*col_f_nvz,8)) then
#if !defined(_OPENMP) && !defined(_OPENACC)
              write(*,'(a,2(i8,1x))') 'Too many negative values at :', spi, floor(negative_count)
              write(*,'(a)') 'All pdfs are NOT updated'
#endif
              update_ok = .false.
              exit
           else
              ! df = dist_iter - dist_n  ! df captures variation of distribution function
              !$omp parallel do private(index_1,index_2) num_threads(col_f_i_nthreads)
              do index_2=1,size(df,2)
                 do index_1=1,size(df,1)
                   df(index_1,index_2) = df_corr(index_1,index_2) * &
                           (col_spall(spi)%pdf_np1(index_1,index_2) - col_spall(spi)%pdf_n(index_1,index_2))
                 enddo
              enddo
           endif !negative_count .gt. 0.3D0*real(col_f_nvr*col_f_nvz,8)

           ! temporary Update of the distribution because next species may have many negative and pdf will not be updated for that case
           !$omp parallel do private(index_1,index_2) num_threads(col_f_i_nthreads)
           do index_2=1,size(df,2)
              do index_1=1,size(df,1)
                 col_spall(spi)%pdf_np1(index_1,index_2) = df(index_1,index_2)  !!+  col_spall(spi)%pdf_n(index_1,index_2) !! this is from kernel (diff. logic)
              enddo !index_1
           enddo !index_2

         enddo !spi
      endif !iter_inter .ge. vpic_inner_iter_max

      !! following legacy
      if (update_ok) then
         do spi=col_f_sp_s, col_f_sp_e
             do ir=1,col_f_nvr
                if(ir==1) then
                    smu_n=col_f_dsmu/3D0
                else
                    smu_n=col_f_dsmu*real(ir-1,8)
                endif !ir == 1
                col_spall(spi)%pdf_np1(ir,:) = col_spall(spi)%pdf_np1(ir,:)/col_spall(spi)%conv_factor*smu_n
             enddo !ir
         enddo !spi
      endif !spi

!$acc wait(istream)

    end subroutine col_fm_core


    !> This routine computes the current moments of the distribution
    !! function: density, parallel and perpendicular temperature,
    !! mean parallel flow and entropy.
    !!
    subroutine col_fm_core_init(spa)
      use sml_module, only : sml_istep, sml_e_charge, sml_mype
      use omp_lib, only: omp_get_thread_num
#ifdef _OPENMP
      use omp_lib, only: omp_get_thread_num
#endif
      implicit none
      type(col_f_sp_type) :: spa   !! species 'a'
      !
      real (8) :: densi, numeric_Ti, eni, momi,entropy_i, eni_perp, eni_par
      integer :: index_i, ithread

      ! Get Eq. Temperature
      densi = 0D0
      momi = 0D0
      eni_perp = 0D0
      eni_par = 0D0
      entropy_i = 0D0
      !$omp parallel do private(index_i) reduction(+:densi,eni_perp,eni_par, &
      !$omp momi,entropy_i) num_threads(col_f_i_nthreads)
      do index_i=1, col_f_nvz
          densi = densi + sum(spa%pdf_n(:,index_i)*spa%vol)
          momi =  momi+sum(spa%pdf_n(:,index_i)*spa%mesh_z(index_i)*spa%vol)
          eni_perp = eni_perp+sum(spa%pdf_n(:,index_i)*spa%mesh_r**2*spa%vol)
          eni_par  = eni_par+sum(spa%pdf_n(:,index_i)*((spa%vpar_beg+spa%mesh_dz*(index_i-1))**2)*spa%vol)
          entropy_i = entropy_i - sum(spa%pdf_n(:,index_i)*log(spa%pdf_n(:,index_i))*spa%vol)
      end do

      momi = spa%mass*momi
      eni_perp = eni_perp*spa%mass
      eni_par = eni_par*spa%mass
      eni = eni_par+eni_perp
      numeric_Ti = eni/(3D0*densi*sml_e_charge)

      !rh We cannot take the flow into account to get the equilibrium temperature in the
      !rh multi-species case. In equilibrium, ions and electrons would flow together. However
      !rh the equilibrium flow is not known. Part of the ion and electron flows will dissipate to
      !rh heat. Therefore, we use the mean kinetic energy to estimate the equilibrium temperature
      spa%numeric_t      = numeric_Ti
      spa%numeric_vth2   = numeric_Ti*sml_e_charge/spa%mass !  sp%mass --> ptl_mass
      !!spa%numeric_dens   = densi
      spa%dens           = densi
      spa%ens            = eni
      spa%mom            = momi

      !! ## ----- For the purpose of diagnosis (print_snapshot)
      !!spa%numeric_T_par  = eni_par/(densi*sml_e_charge)
      !!spa%numeric_T_perp = eni_perp/(2D0*densi*sml_e_charge)

      ithread = omp_get_thread_num()

      if (sml_mype==0 .and. ithread==0) then
        write(spa%spid+1,'(i8,6e20.12)') sml_istep, densi, eni/3D0/densi/sml_e_charge,  &
                                 eni_perp/2D0/densi/sml_e_charge, &
                                 eni_par/densi/sml_e_charge, momi/densi, entropy_i
      endif

      return

    end subroutine col_fm_core_init


    !> This routine evaluates the gyroaveraged Landau
    !! interaction tensor for collisions between different
    !! particle species --> Sec. 2.2 in Hager et al.
    !!
    subroutine col_fm_angle_avg_ab(c1, c2, M_ab)
      use sml_module, only : sml_pi     !! XGC1_3
      use elliptics_mod
      implicit none
      type(col_f_sp_type) :: c1, c2
      real (8), dimension((col_f_nvr-1)*(col_f_nvz-1),3,(col_f_nvr-1)*(col_f_nvz-1)) :: M_ab
      integer :: index_I, index_ip, index_J, index_jp
      integer :: index_rz, index_ac
      real (8) :: r, z, a, c, dz, dz2, r2, a2, lambda, k, kp1_sqrt, km1
      real (8), dimension((col_f_nvr-1)*(col_f_nvz-1)) :: EK, EE, k_eff
      real (8) :: k_eff_scalar
      integer, dimension((col_f_nvr-1)*(col_f_nvz-1)) :: vpic_ierr
      real (8) :: EE_k, EK_k
      real (8) :: I1, I2, I3, temp_cons
      integer :: mesh_Nrm1, mesh_Nzm1
      real(8)::c1_mesh_r_half(lbound(c1%mesh_r_half,1):ubound(c1%mesh_r_half,1))
      real(8)::c1_mesh_z_half(lbound(c1%mesh_z_half,1):ubound(c1%mesh_z_half,1))
      real(8)::c2_mesh_r_half(lbound(c2%mesh_r_half,1):ubound(c2%mesh_r_half,1))
      real(8)::c2_mesh_z_half(lbound(c2%mesh_z_half,1):ubound(c2%mesh_z_half,1))
      logical, parameter :: use_ellip_subroutine = .true.
      !!============================== use_ellip_subroutine=.false.
      integer, parameter ::n_order = 10
      integer :: i,order
      real(kind=8), parameter :: e_tol = 1.0d-8
      integer, parameter :: vl = 64
      real(kind=8), dimension(vl) :: x_n,y_n,Mx_n,My_n,Mz_n
      real(kind=8) :: x_np1,Mx_np1,My_np1,rd
      integer :: iibeg,iiend,iisize,ii
      !!===============================
      logical, external :: is_nan
#ifdef _OPENMP_OFFLOAD
      integer :: ithread,istream
      integer, external :: omp_get_thread_num

      ithread = 0
      ithread = omp_get_thread_num()
      istream = ithread + 1
#endif

#ifdef _OPENACC
      integer :: ithread,istream

      ithread = 0
      istream = ithread + 1
#endif
      mesh_Nrm1 = col_f_nvr-1
      mesh_Nzm1 = col_f_nvz-1

!write(*,*) 'shape(c1_mesh_r_half) = ', shape(c1_mesh_r_half)
!write(*,*) 'shape(c1_mesh_z_half) = ', shape(c1_mesh_z_half)
!write(*,*) 'shape(c2_mesh_r_half) = ', shape(c2_mesh_r_half)
!write(*,*) 'shape(c2_mesh_z_half) = ', shape(c2_mesh_z_half)



      c1_mesh_r_half = c1%mesh_r_half
      c1_mesh_z_half = c1%mesh_z_half
      c2_mesh_r_half = c2%mesh_r_half
      c2_mesh_z_half = c2%mesh_z_half

do index_ip = 1,mesh_Nrm1
!        write(*,*) c1_mesh_r_half(index_ip)
!        write(*,*) c2_mesh_r_half(index_ip)
end do

do index_ip = 1, mesh_Nzm1
!        write(*,*) c1_mesh_z_half(index_ip)
!        write(*,*) c2_mesh_z_half(index_ip)
end do
      x_n = 0D0
      y_n = 0D0
      Mx_n = 0D0
      My_n = 0D0
      Mz_n = 0D0
      EE_k = 0D0
      EK_k = 0D0
      ! new routine
      ! (r,z) : colliding paritcle "c1" - capital index, (a,c) : target particle "c2" - small index
#ifdef _OPENACC
!$acc  kernels  present(M_ab)  ASYNC(istream)&
!$acc& pcopyin(mesh_Nzm1,mesh_Nrm1) &
!$acc& pcopyin(c1_mesh_r_half,c1_mesh_z_half) &
!$acc& pcopyin(c2_mesh_r_half,c2_mesh_z_half)

!$acc  loop collapse(2) independent gang &
!$acc& private( index_I, z, index_J, index_rz, r, r2) &
!$acc& private(index_ip, c, dz, dz2, index_jp, a, a2, index_ac, lambda) &
!$acc& private(k, k_eff, kp1_sqrt, km1, EK, EE, vpic_ierr, I1, I2, I3)  &
!$acc& private(temp_cons) &
!$acc& private(EE_k, EK_k)    &
!$acc& private(x_n,y_n,Mx_n,My_n,Mz_n,i,x_np1,Mx_np1,My_np1,rd) &
!$acc& private(ii,iibeg,iiend,iisize,k_eff_scalar)
#elif _OPENMP_OFFLOAD
!$omp target enter data map(to:mesh_Nzm1, mesh_Nrm1)    &
!$omp& map(to:c1_mesh_r_half, c1_mesh_z_half)           &
!$omp& map(to:c2_mesh_r_half, c2_mesh_z_half)

!!default(none):
!$omp target teams distribute collapse(2) default(none) &
!$omp& shared(EE, EK, vpic_ierr, k_eff, M_ab)           &
!$omp& shared(c2_mesh_r_half, c1_mesh_z_half)           &
!$omp& shared(mesh_Nzm1, mesh_Nrm1, c2_mesh_z_half)     &
!$omp& shared(c1_mesh_r_half)                           &
!$omp& private(k, lambda, index_ac, kp1_sqrt, km1, a2)  &
!$omp& private(a, EE_k, I3, temp_cons, I2, EK_k, I1)    &
!$omp& private(dz2, index_rz, z, r, dz, c, r2, index_J) &
!$omp& private(index_ip, index_jp, index_I, k_eff_scalar)

!!default(private):
!!$omp target teams distribute collapse(2) default(private)      &
!!$omp& shared(EE, EK, vpic_ierr, k_eff, M_ab)                   &
!!$omp& shared(c2_mesh_r_half, c1_mesh_z_half)                   &
!!$omp& shared(mesh_Nzm1, mesh_Nrm1, c2_mesh_z_half)             &
!!$omp& shared(c1_mesh_r_half)                                   
#else
!$OMP PARALLEL DO &
!$OMP& default(none) &
!$OMP& shared(mesh_Nzm1,mesh_Nrm1,c1,c2,M_ab, &
!$OMP&        c1_mesh_z_half, c1_mesh_r_half, c2_mesh_z_half, c2_mesh_r_half) &
!$OMP& PRIVATE( index_I, z, index_J, index_rz, r, r2, index_ip, c, dz, dz2, index_jp, a, a2, index_ac, lambda, &
!$OMP&           k, k_eff, kp1_sqrt, km1, EK, EE, vpic_ierr, I1, I2, I3, temp_cons, &
!$OMP&           EE_k, EK_k, x_n, y_n, Mx_n, My_n, Mz_n, i, x_np1, Mx_np1, My_np1, rd, &
!$OMP&           ii,iibeg,iiend,iisize) &
!$OMP&           num_threads(col_f_i_nthreads)
#endif
      do index_I=1,mesh_Nzm1
          do index_J=1,mesh_Nrm1
              z = c1_mesh_z_half(index_I)
              index_rz = index_J +mesh_Nrm1*(index_I-1)
              r = c1_mesh_r_half(index_J)
              r2 = r*r
if(index_I .eq. 1 .and. index_J .eq. 1) then
 !       write(*,*) 'z = ', z
  !      write(*,*) 'index_rz = ', index_rz
   !     write(*,*) r
!        write(*,*) 'r2 = ', r2
end if
#ifdef _OPENACC
!$acc loop independent collapse(2) worker vector
#elif _OPENMP_OFFLOAD
!!default(none):
!$omp parallel do simd collapse(2) default(none)        &
!$omp& private(lambda, index_ac, a2, k, c, dz)          &
!$omp& private(a, dz2, index_ip, index_jp, k_eff_scalar) &
!$omp& shared(r2, k_eff, r, c2_mesh_r_half, mesh_Nzm1)  &
!$omp& shared(c2_mesh_z_half, mesh_Nrm1, z, index_I)    &
!$omp& shared(EK, EE, vpic_ierr, index_J)

!!default(private):
!!$omp parallel do simd collapse(2) default(private)  &
!!$omp& shared(r2, k_eff, r, c2_mesh_r_half)     &
!!$omp& shared(c2_mesh_z_half, mesh_Nrm1, z, mesh_Nzm1)
#endif
              do index_ip=1, mesh_Nzm1
                  do index_jp=1, mesh_Nrm1
                      c = c2_mesh_z_half(index_ip)
if(index_I .eq. 1 .and. index_J .eq. 1) then
   !     write(*,*) index_ip, index_jp, c
end if
                      dz = z-c
if(index_I .eq. 1 .and. index_J .eq. 1) then
!        write(*,*) index_ip, index_jp, dz
end if
                      dz2 = dz*dz
if(index_I .eq. 1 .and. index_J .eq. 1) then
!        write(*,*) index_ip, index_jp, dz2
end if
                      a = c2_mesh_r_half(index_jp)
if(index_I .eq. 1 .and. index_J .eq. 1) then
       !write(*,*) index_ip, index_jp, a
end if
                      a2 = a*a
if(index_I .eq. 1 .and. index_J .eq. 1) then
!        write(*,*) index_ip, index_jp, a2
end if
                      index_ac = index_jp+mesh_Nrm1*(index_ip-1)
if(index_I .eq. 1 .and. index_J .eq. 1) then
!        write(*,*) index_ip, index_jp, index_ac
end if
                      !lambda
                      lambda = r2+a2+dz2     !symmetric (r<->a, z<->c)
                                             ! i.e. (r,z,a,c) = (a,z,r,c) = (r,c,a,z) = (a,c,r,z) for SAME grid
                                             !      BUT!!, (r,z,a,c) = (a,c,r,z) only due to limitation of our domain for each species
if(index_I .eq. 1 .and. index_J .eq. 1) then
!        write(*,*) index_ip, index_jp, lambda
end if
      
                      k = 2D0*r*a/lambda     !symmetric
if(index_I .eq. 1 .and. index_J .eq. 1) then
!       write(*,*) k, index_ac
end if
!                      k_eff_scalar = 2D0*k/(1D0+k)
 !                     call ellip_agm( k_eff_scalar,  &
  !                            EK(index_ac),EE(index_ac),vpic_ierr(index_ac))
                      k_eff(index_ac) = 2D0*k/(1D0+k)
if(index_I .eq. 1 .and. index_J .eq. 1) then
 !       write(*,*) k_eff(index_ac), index_ac
end if
                  enddo !index_jp
              enddo !index_ip
if(index_I .eq. 1 .and. index_J .eq. 1) then
        do index_ip=1,3872
        !        write(*,*) index_ip, k_eff(index_ip)
        end do
end if
#ifdef _OPENACC
!$acc loop independent collapse(2) worker vector
#elif _OPENMP_OFFLOAD
!!default(none):
!$omp parallel do simd collapse(2) default(none)        &
!$omp& shared(EK, EE, vpic_ierr, mesh_Nrm1, k_eff)      &
!$omp& shared(mesh_Nzm1)                                &
!$omp& private(index_ac)

!!default(private):
!!$omp parallel do simd collapse(2) default(private)      &
!!$omp& shared(EK, EE, vpic_ierr, mesh_Nrm1, k_eff)
#endif
                  do index_ip=1, mesh_Nzm1
                      do index_jp=1, mesh_Nrm1
                          index_ac = index_jp+mesh_Nrm1*(index_ip-1)
                          call ellip_agm( k_eff(index_ac),  &
                              EK(index_ac),EE(index_ac),vpic_ierr(index_ac))
                      enddo !index_jp
                  enddo !index_ip
#ifdef _OPENACC
!$acc loop independent collapse(2) worker vector
#elif _OPENMP_OFFLOAD
!!default(none):
!$omp parallel do simd collapse(2) default(none)                        &
!$omp& private(kp1_sqrt, km1, EE_k, k, I2, I3, temp_cons, EK_k, I1, dz) &
!$omp& private(dz2, c, a, lambda, a2, index_ac)                         &
!$omp& shared(r2, r, EE, EK, z, mesh_Nrm1, c2_mesh_z_half, index_rz)    &
!$omp& shared(M_ab, c2_mesh_r_half, mesh_Nzm1)

!!$omp parallel do simd collapse(2) default(private)                     &
!!$omp& shared(r2, r, EE, EK, z, mesh_Nrm1, c2_mesh_z_half, index_rz)    &
!!$omp& shared(M_ab, c2_mesh_r_half, mesh_Nzm1)
#endif
              do index_ip=1, mesh_Nzm1
                  do index_jp=1, mesh_Nrm1
                      c = c2_mesh_z_half(index_ip)
                      dz = z-c
                      dz2 = dz*dz
                      a = c2_mesh_r_half(index_jp)
                      a2 = a*a
                      index_ac = index_jp+mesh_Nrm1*(index_ip-1)

                      if(index_ac .eq. index_rz) then
                          M_ab(index_ac,:,index_rz) = 0D0  !!! THIS LINE SHOULD BE INVESTIGATED. CONDITIONAL NEEDED?
                          cycle
                      endif

                      !lambda
                      lambda = r2+a2+dz2     !symmetric (r<->a, z<->c)
                                             ! i.e. (r,z,a,c) = (a,z,r,c) = (r,c,a,z) = (a,c,r,z) for SAME grid
                                             !      BUT!!, (r,z,a,c) = (a,c,r,z) only due to limitation of our domain for each species
  
                      k = 2D0*r*a/lambda     !symmetric
                      kp1_sqrt = sqrt(1D0+k)
                      km1 = k-1D0

                      EE_k = EE(index_ac)
                      EK_k = EK(index_ac)
                      !Calulation of M coeff. (all symmetric)
                      I1 = -4D0*((1D0+k)*EE_k-EK_k)/(k*k*kp1_sqrt)
                      I2 = -2D0*EE_k/(km1*kp1_sqrt)
                      I3 = -2D0*(EE_k+km1*EK_k)/(km1*k*kp1_sqrt )
                      !I4 = I2-I1 !For exact Numerical Conservation, and It should be mathematically
                      temp_cons = 4D0*sml_pi/(lambda*sqrt(lambda))
                      M_ab(index_ac,1,index_rz) = temp_cons*(I1*a2+I2*dz2)
                      M_ab(index_ac,2,index_rz) = temp_cons*dz*(I3*a-I2*r)
                      M_ab(index_ac,3,index_rz) = temp_cons*(I2*(r2+a2) - I3*2D0*r*a)
                  enddo !index_jp
              enddo !index_ip
          enddo !index_J
      enddo ! index_I
#ifdef _OPENACC
!$acc end kernels
!$acc wait(istream)
#elif _OPENMP_OFFLOAD
!$omp end target teams distribute

!$omp target exit data map(from:M_ab) map(delete:mesh_Nzm1)     &
!$omp& map(delete:mesh_Nrm1, c1_mesh_r_half, c1_mesh_z_half)    &
!$omp& map(delete:c2_mesh_r_half, c2_mesh_z_half)
#endif
!stop
    end subroutine col_fm_angle_avg_ab


    !> This routine evaluates the gyroaveraged Landau
    !! interaction tensor for collisions between particesl of
    !! the same species --> Sec. 2.2 in Hager et al.
    !! This is cheaper because some symmetries can be exploited.
    !!
    !!M_zr => Ms(2,:,:)
    !!M_rc => Ms(2,:,:)
    !!M_zc => Ms(3,:,:)
    !! cs1 : colliding, cs2 : target
    !! f_half, dfdr, dfdz => cs2
    subroutine col_fm_E_and_D_ab(cs1, cs2, f_half, dfdr, dfdz, Ms, EDs)
      implicit none
      type(col_f_sp_type) :: cs1, cs2
      real (8), dimension(col_f_nvr-1,col_f_nvz-1) :: f_half, dfdr, dfdz
      !!real (8), dimension((col_f_nvr-1)*(col_f_nvz-1),3,(col_f_nvr-1)*(col_f_nvz-1)) :: Ms
      real (8), dimension(col_f_nvrm1_nvzm1,3,col_f_nvrm1_nvzm1) :: Ms
      real (8), dimension(5,col_f_nvr-1, col_f_nvz-1) :: EDs
      integer :: index_I, index_J, index_ip, index_jp, mesh_Nrm1, mesh_Nzm1, index_2dp, index_2D
      real (8) :: tmp_vol, tmp_f_half_v, tmp_dfdr_v, tmp_dfdz_v, mass1_inv, mass2_inv
      real (8) :: tmpr1, tmpr2, tmpr3, tmpr4, tmpr5  !Dmitry
      real (8) :: r, a, z, c, dz, M_ra, M_za ! ES: array reduction
      real (8) :: cs1_mesh_r_half(lbound(cs1%mesh_r_half,1):ubound(cs1%mesh_r_half,1))
      real (8) :: cs1_mesh_z_half(lbound(cs1%mesh_z_half,1):ubound(cs1%mesh_z_half,1))
      real (8) :: cs2_mesh_r_half(lbound(cs2%mesh_r_half,1):ubound(cs2%mesh_r_half,1))
      real (8) :: cs2_mesh_z_half(lbound(cs2%mesh_z_half,1):ubound(cs2%mesh_z_half,1))
      real (8) :: cs2_local_center_volume(lbound(cs2%local_center_volume,1):ubound(cs2%local_center_volume,1))
#ifdef _OPENMP_OFFLOAD
      integer :: ithread,istream
      !integer, external :: omp_get_thread_num
      ithread = 0
      !ithread = omp_get_thread_num()
      istream = ithread + 1
#endif

#ifdef _OPENACC
      integer :: ithread,istream
      !integer, external :: omp_get_thread_num
      ithread = 0
      !ithread = omp_get_thread_num()
      istream = ithread + 1
#endif
      cs1_mesh_r_half = cs1%mesh_r_half
      cs1_mesh_z_half = cs1%mesh_z_half
      cs2_mesh_r_half = cs2%mesh_r_half
      cs2_mesh_z_half = cs2%mesh_z_half
      cs2_local_center_volume = cs2%local_center_volume

      mass1_inv = 1D0/cs1%mass
      mass2_inv = 1D0/cs2%mass

      mesh_Nrm1 = col_f_nvr-1
      mesh_Nzm1 = col_f_nvz-1

#ifdef _OPENACC
!$acc enter data pcreate(EDs) ASYNC(istream)
!$acc kernels present(Ms,EDs) ASYNC(istream)
!$acc loop independent  collapse(2) gang
#elif _OPENMP_OFFLOAD
!!$omp target enter data map(to:Ms)
!!$omp target teams distribute &
!!$omp target enter data map(alloc:EDs) map(to:Ms) depend(out:istream)
!!$omp target teams distribute collapse(2) depend(out:istream) &
!!$omp& private(tmp_f_half_v, tmp_dfdr_v, tmp_vol, a, dz, index_2dp, M_za)       &
!!$omp& private(tmp_dfdz_v, M_ra, r, index_2D, z, c, tmpr1, tmpr2, tmpr3, tmpr4) &
!!$omp& private(tmpr5)                                                          & 
!!$omp& shared(cs2_local_center_volume, f_half, cs2_mesh_r_half, EDs)            &
!!$omp& shared(mass2_inv, mass1_inv, Ms, dfdr, dfdz, cs1_mesh_r_half, mesh_Nzm1) &
!!$omp& shared(cs1_mesh_z_half, mesh_Nrm1, cs2_mesh_z_half)
#else
!$OMP  PARALLEL DO &
!$OMP& default(none) &
!$OMP& shared(mesh_Nzm1,mesh_Nrm1,f_half,dfdr,dfdz,Ms) &
!$OMP& shared(cs1,cs2,EDs,mass1_inv,mass2_inv, &
!$OMP&        cs1_mesh_r_half, cs1_mesh_z_half, cs2_mesh_r_half, cs2_mesh_z_half,cs2_local_center_volume ) &
!$OMP& PRIVATE(index_I,index_J, index_2D, index_ip, index_jp, index_2dp, &
!$OMP&          tmp_vol, tmp_f_half_v, tmp_dfdr_v, tmp_dfdz_v,  &
!$OMP&          r,a,z,c,dz,M_ra,M_za, &
!$OMP&          tmpr1, tmpr2, tmpr3, tmpr4, tmpr5 ) &
!$OMP& num_threads(col_f_i_nthreads)
#endif
      do index_I=1, mesh_Nzm1
          do index_J=1, mesh_Nrm1
              z = cs1_mesh_z_half(index_I)
              r = cs1_mesh_r_half(index_J)
              index_2D = index_J+mesh_Nrm1*(index_I-1)
              tmpr1=0D0
              tmpr2=0D0
              tmpr3=0D0
              tmpr4=0D0
              tmpr5=0D0
#ifdef _OPENACC
!$acc         loop independent collapse(2) vector
#elif _OPENMP_OFFLOAD
!!$omp parallel do simd collapse(2)
!!$omp         parallel do simd collapse(2) default(none) &
!!$omp&        shared(dfdz, r, f_half, dfdr, Ms, index_2D, cs2_mesh_z_half)              &
!!$omp&        shared(mesh_Nzm1, mesh_Nrm1, z, cs2_local_center_volume, cs2_mesh_r_half) &
!!$omp&        private(M_ra, tmp_dfdz_v, tmp_dfdr_v, tmpr3, tmpr4, tmpr5, tmpr2, M_za)   &
!!$omp&        private(tmpr1, tmp_f_half_v, dz, c, tmp_vol, index_2dp, a)
#endif
              do index_ip = 1, mesh_Nzm1
                  do index_jp = 1, mesh_Nrm1
                      c = cs2_mesh_z_half(index_ip)
                      dz = z-c
                      a = cs2_mesh_r_half(index_jp)
                      index_2dp = index_jp+mesh_Nrm1*(index_ip-1)
                      tmp_vol = cs2_local_center_volume(index_jp)
                      tmp_f_half_v = f_half(index_jp, index_ip) * tmp_vol
                      tmp_dfdr_v = dfdr(index_jp, index_ip) * tmp_vol
                      tmp_dfdz_v = dfdz(index_jp, index_ip) * tmp_vol
                      M_ra = (r*Ms(index_2dp,1,index_2D) + dz*Ms(index_2dp,2,index_2D))/a  !ES: array reduction
                      M_za = (r*Ms(index_2dp,2,index_2D) + dz*Ms(index_2dp,3,index_2D))/a  !ES: array reduction

                      ! EDs = 1: Drr, 2: Drz, 3:Dzz, 4:Dzr, 5: Er, 6:Ez
                      !  Ms = 1: M_rr, 2:M_rz, 3:M_zz, 4:M_ra, 5:M_za
                      tmpr1 = tmpr1 + Ms(index_2dp,1,index_2D)*tmp_f_half_v
                      tmpr2 = tmpr2 + Ms(index_2dp,2,index_2D)*tmp_f_half_v
                      tmpr3 = tmpr3 + Ms(index_2dp,3,index_2D)*tmp_f_half_v
                      tmpr4 = tmpr4 + M_ra*tmp_dfdr_v + Ms(index_2dp,2,index_2D)*tmp_dfdz_v
                      tmpr5 = tmpr5 + M_za*tmp_dfdr_v + Ms(index_2dp,3,index_2D)*tmp_dfdz_v  !Multi-species
                  enddo !index_jp
              enddo !index_ip

              ! EDs = 1: Drr, 2: Drz, 3:Dzz, 4:Dzr, 5: Er, 6:Ez
              !mass correction
              EDs(1,index_J,index_I) = tmpr1*mass1_inv
              EDs(2,index_J,index_I) = tmpr2*mass1_inv
              EDs(3,index_J,index_I) = tmpr3*mass1_inv
              EDs(4,index_J,index_I) = tmpr4*mass2_inv
              EDs(5,index_J,index_I) = tmpr5*mass2_inv
          enddo !index_J
      enddo !index_I
#ifdef _OPENACC
!$acc end kernels
!$acc wait(istream)
!$acc exit data copyout(EDs) ASYNC(istream)
!$acc wait(istream)
#elif _OPENMP_OFFLOAD
!!$omp end target teams distribute
!!$omp target exit data map(from:EDs)
!!$omp task depend(in:istream)
!!$omp target exit data map(from:EDs) depend(out:istream)
!!$omp end task
!!$omp target exit data map(from:EDs)
#endif
    end subroutine col_fm_E_and_D_ab

    !! same with col_f_angle_avg_s. But need to check perofrmance issue for simplified code script
    subroutine col_fm_angle_avg_s(cs, Ms)
      use sml_module, only : sml_pi     !! XGC1_3
      use elliptics_mod
      implicit none
      type(col_f_sp_type) :: cs   !! DIFF: type
      !!real (8), dimension(col_f_nvr-1,5,(col_f_nvr-1)*(col_f_nvz-1)) :: Ms
      real (8), dimension(col_f_nvrm1,5,col_f_nvrm1_nvzm1) :: Ms
      integer :: index_dz, index_J, index_jp
      integer :: index_rz
      real (8) :: r, a, dz, dz2, r2, a2, lambda, k, k_eff, kp1_sqrt, km1, EK, EE, mesh_dz
      integer :: vpic_ierr
      real (8) :: I1, I2, I3, temp_cons
      integer :: mesh_Nrm1, mesh_Nzm1
      !!real (8) :: M_rr_v, M_rz_v, M_zz_v, M_ra_v, M_za_v
      real (8) :: tmp_vol(col_f_nvr-1), tmp_volr
      integer :: vpic_ierr0
      !!real*8::cs_mesh_r_half(lbound(cs(0)%mesh_r_half,1):ubound(cs(0)%mesh_r_half,1))
      real*8::cs_mesh_r_half(lbound(cs%mesh_r_half,1):ubound(cs%mesh_r_half,1))
#ifdef _OPENACC
      integer :: ithread,istream
      !integer, external :: omp_get_thread_num

      ithread = 0
      !ithread = omp_get_thread_num()
      istream = ithread + 1
#endif
#ifdef _OPENMP_OFFLOAD
      integer :: ithread,istream
      !integer, external :: omp_get_thread_num

      ithread = 0
      !ithread = omp_get_thread_num()
      istream = ithread + 1
#endif

      mesh_Nrm1 = col_f_nvr-1
      mesh_Nzm1 = col_f_nvz-1

      vpic_ierr = 0
      vpic_ierr0 = 0

      cs_mesh_r_half = cs%mesh_r_half
      mesh_dz = cs%mesh_dz
      tmp_vol = cs%local_center_volume  ! It is volume for prime coordinate. cs2. For same species, both cs1 and cs 2 has same

#ifdef _OPENACC
!$acc kernels                                              &
!$acc& pcopyin(mesh_Nrm1,mesh_Nzm1,cs_mesh_r_half,tmp_vol,mesh_dz)       &
!$acc& present(Ms)

!$acc loop independent collapse(2) gang  &
!$acc& private(EE,EK, index_J, index_dz, index_jp, r, r2, index_rz, a, a2, tmp_volr, dz, dz2) &
!$acc& private(lambda, k, k_eff, kp1_sqrt, km1, I1, I2, I3, temp_cons,vpic_ierr0)
#elif _OPENMP_OFFLOAD
!!$omp target enter data map(to:mesh_Nrm1, mesh_Nzm1, cs_mesh_r_half, tmp_vol, mesh_dz)

!!$omp target teams distribute collapse(2) default(none)                                        &
!!$omp& private(EE, EK, index_J, index_dz, index_jp, r, r2, index_rz, a, a2, tmp_volr, dz, dz2) &
!!$omp& private(lambda, k, k_eff, kp1_sqrt, km1, I1, I2, I3, temp_cons, vpic_ierr0)             &
!!$omp& shared(tmp_vol, mesh_dz, vpic_ierr, Ms, mesh_Nrm1, mesh_Nzm1, cs_mesh_r_half)
#else
!$omp parallel do default(none) collapse(3)                             &
!$omp& shared(mesh_Nrm1,mesh_Nzm1,cs_mesh_r_half,tmp_vol,mesh_dz)       &
!$omp& shared(Ms)                                                       &
!$omp& private(index_J,r,r2,index_dz,index_rz,index_jp)                 &
!$omp& private(a,a2,tmp_volr,dz,dz2,lambda,k,k_eff,kp1_sqrt,km1)        &
!$omp& private(vpic_ierr0) reduction(max:vpic_ierr)                     &
!$omp& private(EK,EE,I1,I2,I3,temp_cons)                                &
!$omp& num_threads(col_f_i_nthreads)
#endif
     do index_J=1,mesh_Nrm1
        do index_dz=0,mesh_Nzm1-1
#ifdef _OPENACC
!$acc loop independent vector
!!$acc& private(index_jp, r, r2, index_rz, a, a2, tmp_volr, dz, dz2) &
!!$acc& private(lambda, k, k_eff, kp1_sqrt, km1, I1, I2, I3, temp_cons)&
!!!!$acc& private(M_rr_v, M_rz_v, M_zz_v, M_ra_v, M_za_v)
#elif _OPENMP_OFFLOAD
!!$omp parallel do simd default(none)                                    &
!!$omp& private(k_eff, kp1_sqrt, km1, lambda, dz2, k, EK, EE, tmp_volr)  &
!!$omp& private(dz, vpic_ierr0, a2, a, index_rz, r2, I1, temp_cons, r)   &
!!$omp& private(I3, I2)                                                  &
!!$omp& shared(Ms, tmp_vol, mesh_dz, index_dz, mesh_Nrm1, index_J)       &
!!$omp& shared(cs_mesh_r_half)                                           &
!!$omp& reduction(max:vpic_ierr)                                         

!Permanently commented
!!$omp& shared(mesh_dz, tmp_vol, Ms, mesh_Nzm1, cs_mesh_r_half, index_J) &
!!$omp& shared(mesh_Nrm1, index_dz)
#endif
           do index_jp=1, mesh_Nrm1
              r=cs_mesh_r_half(index_J)
              r2 = r*r

              index_rz = index_J +mesh_Nrm1*index_dz   ! (=index_2D in MATLAB)
              !!index_ac = index_jp ! (=index_2d in MATLAB)
              if(index_jp .eq. index_rz) then
                 Ms(index_jp,:,index_rz) = 0D0
                 cycle
              endif

              a=cs_mesh_r_half(index_jp)
              a2 = a*a
              tmp_volr = tmp_vol(index_jp)

              dz = mesh_dz*index_dz
              dz2 = dz*dz


              lambda = r2+a2+dz2     !symmetric (r<->a, z<->c)
                                   ! i.e. (r,z,a,c) = (a,z,r,c) = (r,c,a,z) =
                                   ! (a,c,r,z)
              k = 2D0*r*a/lambda     !symmetric
              k_eff = 2D0*k/(1D0+k)
              kp1_sqrt = sqrt(1D0+k)
              km1 = k-1D0

              !k_eff=min(k_eff,0.95D0)
              call ellip_agm(k_eff,EK,EE,vpic_ierr0)

              !vpic_ierr = max(vpic_ierr,vpic_ierr0)   ! ES : This line is to be
              !considered again
              vpic_ierr = 0   ! ES : This line is to be considered again

              !Calulation of M coeff. (all symmetric)
              I1 = -4D0*((1D0+k)*EE-EK)/(k*k*kp1_sqrt)
              I2 = -2D0*EE/(km1*kp1_sqrt)
              I3 = -2D0*(EE+km1*EK)/(km1*k*kp1_sqrt )
              !I4 = I2-I1 !For exact Numerical Conservation, and It shoudl be
              !mathematically
              temp_cons = 4D0*sml_pi/(lambda*sqrt(lambda)) * tmp_volr  !tmp_volr is from E_and_D  - PATCH02-2

              !NOTE THAT CONSIDERING SYMMETRY, we already have
              ! I1, I2, I3 at (r,z,a,c), (a,z,r,c), (r,c,a,z), and (a,c,r,z)
              ! ->(jp,ip,J,I)
              ! Using this values, we calculate symmetric and asymmetric
              ! compoenents of matrix
              ! index_rz = index_J +mesh_Nrm1*index_I
              ! index_rc = index_J +mesh_Nrm1*index_ip
              ! index_ac = index_jp+mesh_Nrm1*index_ip
              ! index_az = index_jp+mesh_Nrm1*index_I
              Ms(index_jp,1,index_rz) = temp_cons*(I1*a2+I2*dz2)
              Ms(index_jp,2,index_rz) = temp_cons*dz*(I3*a-I2*r)
              Ms(index_jp,3,index_rz) = temp_cons*(I2*(r2+a2) - I3*2D0*r*a)
              Ms(index_jp,4,index_rz) = temp_cons*(I1*r*a + I3*dz2)
              Ms(index_jp,5,index_rz) = temp_cons*dz*(I2*a-I3*r)
              !(a,c,r,z)=(r,z,a,c)
              ! 1: M_rr, 2:M_rz, 3:M_zz, 4:M_ra
              !!Ms(index_ac,1,index_rz) = M_rr_v
              !!Ms(index_ac,2,index_rz) = M_rz_v
              !!Ms(index_ac,3,index_rz) = M_zz_v
              !!Ms(index_ac,4,index_rz) = M_ra_v
              !!Ms(index_ac,5,index_rz) = M_za_v
           enddo  !index_jp
        enddo ! index_dz
     enddo !index_J
#ifdef _OPENACC
!$acc end kernels
!$acc wait(istream)
#elif _OPENMP_OFFLOAD
!!$omp end target teams distribute

!!$omp target exit data map(from:Ms) map(delete:mesh_Nrm1, mesh_Nzm1, cs_mesh_r_half, tmp_vol, mesh_dz)
#endif
    end subroutine col_fm_angle_avg_s


    !> Calculation of the distribution function and its finite difference
    !! derivative between grid points for conservation of the thermal equilibrium
    !! as discussed in section 2.5 in Hager et al.
    subroutine col_fm_f_df(cs, op_mode, f_half, dfdr, dfdz)
      implicit none
      type(col_f_sp_type), intent(in) :: cs
      integer, intent(in) :: op_mode
      real(kind=8), dimension(col_f_nvr-1, col_f_nvz-1) :: f_half, dfdr, dfdz
      real(kind=8) :: tmpr1, tmpr2, tmpr3, tmpr4
      integer :: index_I, index_J
      ! For finite difference parameter
      real (kind=8) :: delr, cdelr, delz, cdelz
      !$omp parallel do private(index_I,index_J,tmpr1,tmpr2,tmpr3,tmpr4,delr,cdelr,delz,cdelz) num_threads(col_f_i_nthreads)
      do index_I=1,col_f_nvz-1
          do index_J=1, col_f_nvr-1
              delr = cs%delta_r(index_J,op_mode)
              cdelr = 1D0-delr
              delz = cs%delta_z(index_I,op_mode)
              cdelz = 1D0-delz

              tmpr1 = cs%pdf_np1(index_J, index_I)
              tmpr2 = cs%pdf_np1(index_J+1, index_I)
              tmpr3 = cs%pdf_np1(index_J,index_I+1)
              tmpr4 = cs%pdf_np1(index_J+1,index_I+1)

              ! With delta_(r,z)=0.5
              !f_half(index_J, index_I) = (tmpr1 + tmpr3 + tmpr2 + tmpr4)*0.25D0
              !dfdr(index_J, index_I) = ((tmpr2 - tmpr1)+(tmpr4 - tmpr3))*0.5D0
              !dfdz(index_J, index_I) = ((tmpr3 - tmpr1)+(tmpr4 - tmpr2))*0.5D0

              ! With finite difference factor
              f_half(index_J, index_I) = tmpr1 * delr*delz &
                                        + tmpr3 * delr*cdelz &
                                        + tmpr2 * cdelr*delz &
                                        + tmpr4 * cdelr*cdelz
              dfdr(index_J, index_I) = (tmpr2 - tmpr1)*delz &
                                      +(tmpr4 - tmpr3)*cdelz
              dfdz(index_J, index_I) = (tmpr3 - tmpr1)*delr &
                                      +(tmpr4 - tmpr2)*cdelr
          enddo
      enddo

      ! dfdr = dfdr/mesh_dr
      !$omp parallel do private(index_I,index_J) num_threads(col_f_i_nthreads)
      do index_I=1,size(dfdr,2)
        do index_J=1,size(dfdr,1)
           dfdr(index_J,index_I) = dfdr(index_J,index_I)/cs%mesh_dr
        enddo
      enddo

      ! dfdz = dfdz/mesh_dz
      !$omp parallel do private(index_I,index_J) num_threads(col_f_i_nthreads)
      do index_I=1,size(dfdz,2)
        do index_J=1,size(dfdz,1)
          dfdz(index_J,index_I) = dfdz(index_J,index_I)/cs%mesh_dz
        enddo
      enddo

      return

    end subroutine col_fm_f_df


    !> Evaluates the advection/diffusion tensors E and D as desribed in
    !! Eqs. (2) and (19) in Hager et al.
    !!
    subroutine col_fm_E_and_D_s(mass, f_half, dfdr, dfdz, Ms, EDs)
      !cs1 : colliding, cs2 : target
      !f_half, dfdr, dfdz => cs2
      implicit none
      real (8) :: mass
      real (8), dimension(col_f_nvr-1,col_f_nvz-1) :: f_half, dfdr, dfdz
      !!real (8), dimension(col_f_nvr-1,5, (col_f_nvr-1)*(col_f_nvz-1)) :: Ms
      real (8), dimension(col_f_nvr-1,5, col_f_nvrm1_nvzm1) :: Ms
      real (8), dimension(5,col_f_nvr-1, col_f_nvz-1) :: EDs
      integer :: index_I, index_J, index_ip, index_jp, mesh_Nrm1, mesh_Nzm1, index_2D, sav_i, index_dz
      real (8) :: tmp_f_half_v, tmp_dfdr_v, tmp_dfdz_v
      real (8) :: sum1,sum2,sum3,sum4,sum5,inv_mass
      real (8) :: csign
      integer :: lb1,ub1, lb2,ub2, lb3,ub3
#ifdef _OPENMP_OFFLOAD
      integer :: istream, ithread
      !integer, external :: omp_get_thread_num

      ithread = 0
      !ithread = omp_get_thread_num()
      istream = ithread + 1
#endif

#ifdef _OPENACC
      integer :: istream, ithread
      !integer, external :: omp_get_thread_num

      ithread = 0
      !ithread = omp_get_thread_num()
      istream = ithread + 1
#endif
      mesh_Nrm1 = col_f_nvr-1
      mesh_Nzm1 = col_f_nvz-1

      sav_i = 0
      index_jp = 0
      index_ip = 0
      index_i = 0
 


#ifdef _OPENACC
!$acc  enter data pcreate(EDs) ASYNC(istream)

!$acc  parallel ASYNC(istream)                           &
!$acc& present(Ms,EDs)                                   &
!$acc& pcopyin(mesh_Nrm1,mesh_Nzm1,f_half,dfdr,dfdz)

!$acc loop independent  collapse(2) gang  &
!$acc& private(csign,index_jp,index_ip,index_2D,index_dz,sav_i,tmp_f_half_v,tmp_dfdr_v,tmp_dfdz_v)
#elif _OPENMP_OFFLOAD
!Temporarily commented out code:
!!$omp target enter data map(to:mesh_Nrm1, mesh_Nzm1, f_half, dfdr, dfdz, EDs)
!map(alloc:EDs)
!depend(out:istream)

!!$omp target teams distribute collapse(2) &
!!$omp& private(csign,index_jp,index_ip,index_2d,index_dz,sav_i,tmp_f_half_v,tmp_dfdr_v,tmp_dfdz_v) &
!!$omp& private(inv_mass,lb1,lb2,lb3,ub1,ub2,ub3,sum1,sum2,sum3,sum4,sum5)
!depend(out:istream)
!!$omp target enter data map(alloc:EDs)

!!$omp target data map(to:mesh_Nrm1,mesh_Nzm1,f_half,dfdr,dfdz)

!!$omp target teams distribute collapse(2) default(none)       &
!!$omp& private(tmp_f_half_v, f_half, index_2D, csign)         &
!!$omp& private(index_ip, tmp_dfdr_v, tmp_dfdz_v, index_dz)    &
!!$omp& private(sum1, sum2, sum5, sum4, sum3)                  &
!!$omp& shared(Ms, EDs, dfdz, dfdr, mesh_Nrm1, mesh_Nzm1)
#else
!$omp parallel do default(none)                               &
!$omp& collapse(2)                                            &
!$omp& shared(mesh_Nrm1,mesh_Nzm1,f_half,dfdr,dfdz)           &
!$omp& shared(Ms,EDs)                                         &
!$omp& private(index_J,index_dz,index_2D,index_jp)            &
!$omp& private(sav_i,index_I,index_ip)                        &
!$omp& private(tmp_f_half_v,tmp_dfdr_v,tmp_dfdz_v)            &
!$omp& private(sum1,sum2,sum3,sum4,sum5)                      &
!$omp& private(csign)                                         &
!$omp& num_threads(col_f_i_nthreads)
#endif
      do index_J=1, mesh_Nrm1
        do index_I=1, mesh_Nzm1
          !
          ! (1) index_I = 1 + index_dz + sav_i
          ! (2) 0 <= sav_i <= mesh_Nzm1-1
          ! (3) 0 <= index_dz <= mesh_Nzm1-1
          ! from (1)    sav_i = (index_I-1) - index_dz
          ! from (3) (index_I-1) - (mesh_Nzm1-1) <=  sav_i <= (index_I-1) - 0
          ! from (2) max(0,(index_I-1)-(mesh_Nzm1-1)) <= sav_i <= min((index_I-1),mesh_Nzm1-1)
          ! index_dz = index_I-1-sav_i
          sum1 = 0
          sum2 = 0
          sum3 = 0
          sum4 = 0
          sum5 = 0
!!$acc loop independent worker reduction(+:sum1,sum2,sum3,sum4,sum5)
#ifdef _OPENMP_OFFLOAD
!!$omp parallel do collapse(2) 
!default(none)                                    
!!$omp& private(tmp_dfdz_v, tmp_f_half_v, tmp_dfdr_v, index_dz, csign)   &
!!$omp& private(index_ip, index_2D)                                      &
!!$omp& shared(dfdr, dfdz, f_half, Ms, mesh_Nzm1, mesh_Nrm1, index_I)    &
!!$omp& shared(index_J)                                                  &
!!$omp& reduction(+:sum1, sum2, sum3, sum4, sum5)
#endif
          do sav_i=0,(mesh_Nzm1-1)
            if (sav_i <= (index_I-1)) then
              ! index_I  = 1+index_dz+sav_i
              index_dz = index_I-1-sav_i
              csign = 1
            else
              !index_I = 1-index_dz+sav_i
              index_dz = 1 + sav_i - index_I
              csign = -1
            endif
            index_ip = 1+sav_i
            index_2D = index_J+mesh_Nrm1*index_dz  ! This is index for the Ms


            ! (original) EDs = 1: Drr, 2: Drz, 3:Dzz, 4:Dzr, 5: Er, 6:Ez
            ! (reduced)  EDs = 1: Drr, 2: Drz, 3:Dzz, 4: Er, 5:Ez   ! Drz = Dzr
            !  Ms = 1: M_rr, 2:M_rz, 3:M_zz, 4:M_ra, 5:M_za
!!$acc loop independent vector
#ifdef _OPENMP_OFFLOAD
!!$omp simd
#endif
            do index_jp=1, mesh_Nrm1
              !!index_2dp = index_jp  ! This is index for the Ms
              tmp_f_half_v = f_half(index_jp, index_ip)
              tmp_dfdr_v   = dfdr(index_jp, index_ip)
              tmp_dfdz_v   = dfdz(index_jp, index_ip)
              sum1 = sum1 + Ms(index_jp,1,index_2D)*tmp_f_half_v
              sum2 = sum2 + csign*Ms(index_jp,2,index_2D)*tmp_f_half_v
              sum3 = sum3 + Ms(index_jp,3,index_2D)*tmp_f_half_v
              sum4 = sum4 + Ms(index_jp,4,index_2D)*tmp_dfdr_v + &
                            csign*Ms(index_jp,2,index_2D)*tmp_dfdz_v
              sum5 = sum5 + Ms(index_jp,3,index_2D)*tmp_dfdz_v + &
                            csign*Ms(index_jp,5,index_2D)*tmp_dfdr_v
            enddo !index_jp
          enddo !sav_i

          EDs(1,index_J,index_I) =  sum1
          EDs(2,index_J,index_I) =  sum2
          EDs(3,index_J,index_I) =  sum3
          EDs(4,index_J,index_I) =  sum4
          EDs(5,index_J,index_I) =  sum5
        enddo !index_I
      enddo !index_J
#ifdef _OPENACC
!$acc end parallel
!$acc wait(istream)
#elif _OPENMP_OFFLOAD
!!$omp task depend(in:istream)
!!$omp target exit data map(from:EDs)
#endif


      ! (original) EDs = 1: Drr, 2: Drz, 3:Dzz, 4:Dzr, 5: Er, 6:Ez
      ! (reduced)  EDs = 1: Drr, 2: Drz, 3:Dzz, 4: Er, 5:Ez
      !mass correction
      !EDs = EDs/mass
      inv_mass = 1D0/mass
      lb1 = lbound(EDs,1)
      lb2 = lbound(EDs,2)
      lb3 = lbound(EDs,3)
      ub1 = ubound(EDs,1)
      ub2 = ubound(EDs,2)
      ub3 = ubound(EDs,3)

#ifdef _OPENACC
!$acc  kernels  ASYNC(istream)                          &
!$acc& pcopyin(inv_mass)                                &
!$acc& pcopyin(lb1,ub1,lb2,ub2,lb3,ub3)                 &
!$acc& present(EDs)
#elif _OPENMP_OFFLOAD
!!$omp parallel do collapse(2)
!!$omp target teams distribute depend(out:istream) &
!!$omp& map(to:inv_mass, lb1, ub1, ub2, lb3, ub3)
!!$omp target data map(to:inv_mass,lb1, ub1, ub2, lb3, ub3)

!!$omp target teams distribute default(none)             &
!!$omp& shared(lb3,ub3,lb2,ub2,lb1,ub1,EDs,inv_mass)
#else
!!$omp  parallel do default(none)                        &
!!$omp& private(index_i,index_j,index_ip)                &
!!$omp& shared(lb1,ub1,lb2,ub2,lb3,ub3)                  &
!!$omp& shared(EDs,inv_mass)                             &
!!$omp& num_threads(col_f_i_nthreads)
#endif
      do index_j=lb3,ub3
         do index_i=lb2,ub2
            do index_ip=lb1,ub1
               EDs(index_ip,index_i,index_j) = EDs(index_ip,index_i,index_j)*inv_mass
            enddo
         enddo
      enddo
#ifdef _OPENACC
!$acc end kernels
!$acc wait(istream)
#elif _OPENMP_OFFLOAD
!Temporarily commented out code:
!!$omp end target teams distribute

!$omp target exit data map(delete:mesh_Nrm1, mesh_Nzm1, f_half, dfdr, dfdz) map(from:EDs)

!Permanently commented out code:
!!$omp task depend(in:istream)
!!$omp end target data
#endif

#ifdef _OPENACC
!$acc  exit data   copyout(EDs) ASYNC(istream)
!$acc  wait(istream)
#elif _OPENMP_OFFLOAD
!Temporarily comented out code:
!!$omp target exit data map(from:EDs) 

!Permanently commented out code:
!depend(out:istream)
!!$omp end task
!!$omp target exit data map(delete:mesh_Nrm1, mesh_Nzm1, f_half, dfdr, dfdz)
!map(from:EDs) 
!map(delete:mesh_Nrm1, mesh_Nzm1, f_half, dfdr,dfdz)
!map(release:EDs) map(delete:mesh_Nrm1, mesh_Nzm1, f_half, dfdr, dfdz)
!map(from:EDs)
#endif

    end subroutine col_fm_E_and_D_s


    !> Single Picard step in backward Euler scheme.
    !!
    subroutine col_fm_picard_step(iter_inter, LU_values, dist_col, dist_iter)
      implicit none
      integer :: iter_inter
      real (kind=8), dimension(LU_nnz) :: LU_values
      real (kind=8), dimension (col_f_ntotal_v) :: dist_col
      real (kind=8), dimension(col_f_nvr,col_f_nvz) :: dist_iter
      integer :: LU_info
      integer :: index_I, index_J, mat_pos, mat_pos_d, local_ij, local_i, local_j

      if( iter_inter .eq. 1 ) then
        !$omp   parallel do private(index_I,index_J) num_threads(col_f_i_nthreads)
        do index_I=1,size(dist_iter,2)
          do index_J=1,size(dist_iter,1)
             dist_iter(index_J,index_I) = 0
          enddo
        enddo
        !$omp   parallel do                                                         &
        !$omp&  default(none)                                                       &
        !$omp&  shared(col_f_nvr,col_f_nvz)                                         &
        !$omp&  shared(dist_iter,LU_values,LU_Cvalues,index_map_LU,dist_col)        &
        !$omp&  private(index_I,index_J,mat_pos,local_ij,local_i,local_j,mat_pos_d) &
        !$omp&  num_threads(col_f_i_nthreads)
        do index_I=1,col_f_nvz
            do index_J=1, col_f_nvr
               mat_pos = index_J+(index_I-1)*col_f_nvr

               !explicit time marching for 1st guess
               do local_ij=1,9
                  local_i = (local_ij-1)/3 - 1
                  local_j = mod(local_ij-1,3) - 1
                  if( index_J+local_j .gt. 0 .and. index_I+local_i .gt. 0  &
                      .and. index_J+local_j .lt. col_f_nvr+1               &
                      .and. index_I+local_i .lt. col_f_nvz+1 ) then
                      !valid mesh

                      mat_pos_d = (index_J+local_j)+((index_I+local_i)-1)*col_f_nvr
                      if( local_ij .eq. 5 ) then
                          ! (I + L(f^n) dt) f^n  : diagonal part
                          dist_iter(index_J, index_I) = dist_iter(index_J, index_I)  &
                                    +(1D0 + LU_values(LU_Cvalues(mat_pos_d))) * dist_col(mat_pos_d)
                          !print *, LU_values(LU_Cvalues(mat_pos))*vpic_tstep*vpic_gamma, vpic_tstep
                      else
                          ! L(f^n) dt f^n : off-diagonal part
                          dist_iter(index_J, index_I) = dist_iter(index_J, index_I)  &
                                    +LU_values(index_map_LU(local_ij,mat_pos)) * dist_col(mat_pos_d)
                      endif
                  endif
               enddo   !local_ij
            enddo  !index_J
        enddo  !index_I
      else
        !IMPLICIT TIME MARCHING
        ! NOTE!!!! THAT the below "-" sign has some reasons.
        ! There can be easy mistakes that I(identity) - M does not mean
        ! 1-diagonal part. Off-diagonal part will change to -M. Be careful!

        ! LU_values = -LU_values
        !$omp   parallel do private(index_I) num_threads(col_f_i_nthreads)
        do index_I=1,size(LU_values)
          LU_values(index_I) = -LU_values(index_I)
        enddo

        LU_values(LU_cvalues) = 1D0 + LU_values(LU_cvalues)

        !Then, finally solve! Super LU!! =)
        !SUPER LU!!!! - We can directly call superLU wihtout below wrapper function!
        call bsolver(LU_n,LU_nnz,LU_nrhs,LU_values, LU_rowindx, LU_colptr, &
                     dist_col, LU_ldb, LU_info )

        if(LU_info .ne. 0) then
            write(*,*) 'LU solver : Info = ',LU_info
            write(*,*) 'It is very possible that you got NAN or INF ', &
                       'since matrix component is NAN or INF'
        endif
        !$omp   parallel do private(index_I,index_J,mat_pos) num_threads(col_f_i_nthreads)
        do index_I=1,col_f_nvz
          do index_J=1,col_f_nvr
            mat_pos = index_J+(index_I-1)*col_f_nvr
            dist_iter(index_J,index_I) = dist_col( mat_pos )
          enddo
        enddo
      endif

      return

    end subroutine col_fm_picard_step


    !> Checks the convergence criterion (i.e. conservation of
    !! mass, energy and momentum.
    !!
    subroutine col_fm_convergence_eval(cs, col_dw, col_dp, col_dn_n)
      implicit none
      type(col_f_sp_type) :: cs
      real (8) :: col_dw, col_dp, col_dn_n
      !! dist_n <- pdf_n, dist_iter <- pdf_np1
      !!real (kind=8), dimension(col_f_nvr, col_f_nvz) :: dist_iter   ! local
      real (8) :: vpic_dn, vpic_dw, vpic_dp !! were output
      real (8) :: vpic_dfc
      integer :: index_I, index_J
      real (8) :: tmpr1, tmpr12, tmpr2, tmpr3
      ! DIST_ITER has new updated PDF.

      vpic_dn = 0D0
      vpic_dw = 0D0
      vpic_dp = 0D0

      !--------------------------------
      !efd add more reduction variables
      !--------------------------------
      !$omp  parallel do &
      !$omp& shared(cs)  &
      !$omp& private(index_I,index_J,tmpr1,tmpr12,tmpr2,tmpr3,vpic_dfc) &
      !$omp& reduction(+:vpic_dn,vpic_dw,vpic_dp)            &
      !$omp& num_threads(col_f_i_nthreads)
      do index_I=1,col_f_nvz
          tmpr1 = cs%mesh_z(index_I)
          tmpr12 = tmpr1*tmpr1     ! mesh_z^2
          do index_J=1,col_f_nvr
              tmpr2 = cs%mesh_r(index_J)
              tmpr2 = tmpr2*tmpr2     ! mesh_r^2
              tmpr3 = tmpr12+tmpr2     ! mesh_z^2+mesh_r^2
              vpic_dfc = (cs%pdf_np1(index_J,index_I) - cs%pdf_n(index_J, index_I))*cs%vol(index_J)

              vpic_dn = vpic_dn + vpic_dfc
              vpic_dw = vpic_dw + vpic_dfc * tmpr3
              vpic_dp = vpic_dp + vpic_dfc * cs%mesh_z(index_I)
          enddo
      enddo

      col_dw     = vpic_dw*cs%mass
      col_dp     = vpic_dp*cs%mass
      col_dn_n   = dabs(vpic_dn/cs%dens)

      return

    end subroutine col_fm_convergence_eval


    !> Computes the shift for inter-grid quantities (Sec. 2.5 in Hager et al.)
    !!
    subroutine col_fm_core_delta_init(spa, spb)
      use sml_module, only : sml_e_charge     !! XGC1_3
      implicit none
      type(col_f_sp_type), intent(inout) :: spa, spb
      real (kind=8) :: maxw_fac !, en_t, maxw(4), alpha(4)
      real (kind=8) :: lambda_r, lambda_z, delta(2) !, a, b, c, d, beta
      real (kind=8) :: arg
      ! Limits argument to exp(:), exp(227.0) = 3.8E98
      real (kind=8), parameter :: arg_max = 227.0d0
      real (kind=8), parameter :: arg_min = -arg_max
      integer :: mesh_Nrm1, mesh_Nzm1, index_i, index_j
      real (kind=8) :: numeric_teq, numeric_vtheq2

      mesh_Nrm1 = col_f_nvr-1
      mesh_Nzm1 = col_f_nvz-1

      if(spa%spid .eq. spb%spid) then !! ### ----- Same-species collisions

        !! ### ----- R-direction
        !$omp parallel do &
        !$omp default(none) &
        !$omp shared(mesh_Nrm1,spa) &
        !$omp private(index_j,lambda_r,arg,maxw_fac,delta) num_threads(col_f_i_nthreads)
        do index_j=1, mesh_Nrm1
           ! Same-species collisions
           lambda_r = -spa%mesh_r_half(index_j)/spa%numeric_vth2 * spa%mesh_dr
           arg = (spa%mesh_dr*(spa%mesh_dr+2D0*spa%mesh_r(index_j))/ &
                      (2D0*spa%numeric_vth2))
           arg = max(arg_min,min(arg_max, arg))
           if (abs(arg) <= 1.0d-6) then
             maxw_fac = -arg*(1.0d0+arg/2.0d0*(1.0d0+arg/3.0d0))
           else
             maxw_fac=1D0-exp(arg)
           endif
           delta(1)=1D0/maxw_fac-1D0/lambda_r
           delta(2)=1D0/maxw_fac
           if (0D0 .lt. delta(1) .and. delta(1) .lt. 1) then
              spa%delta_r(index_j,spa%spid)=delta(1)
           elseif (0D0 .lt. delta(2) .and. delta(2) .lt. 1) then
              spa%delta_r(index_j,spa%spid)=delta(2)
           else
              write(*,'(a)') 'COL_F_CORE_DELTA_INIT: Error (1a-fm) in calculation ' // &
                              ' of finite difference parameter!'
              write(*,'(i8,5(e22.12,1x))') index_j, maxw_fac, lambda_r, delta(1), delta(2), arg
              write(*,'(4(e22.12,1x))') spa%mesh_r(index_j), spa%mesh_r_half(index_j),  &
                                        spa%numeric_vth2, spa%mesh_dr
              write(*,'(2(e22.12,1x))')  spa%numeric_t, spa%dens
              stop
           endif
        enddo

        !! ### ----- Z-direction
        !$omp parallel do &
        !$omp default(none) &
        !$omp shared(mesh_Nzm1,spa) &
        !$omp private(index_i,lambda_z,arg,maxw_fac,delta) num_threads(col_f_i_nthreads)
        do index_i=1, mesh_Nzm1
           lambda_z = -spa%mesh_z_half(index_i)/spa%numeric_vth2 * spa%mesh_dz
           arg = (spa%mesh_dz*(spa%mesh_dz+2D0*spa%mesh_z(index_i))/ &
                      (2D0*spa%numeric_vth2))
           arg = max(arg_min,min(arg_max, arg))
           if (abs(arg) <= 1.0d-6) then
             maxw_fac = -arg*(1.0d0+arg/2.0d0*(1.0d0+arg/3.0d0))
           else
             maxw_fac=1D0-exp(arg)
           endif
           if(abs(spa%mesh_z_half(index_i)) .lt. 0.25D0*spa%mesh_dz) then
              delta(1) = 0.5D0
              delta(2) = 0.5D0
           else
              delta(1) = (lambda_z - maxw_fac)/(maxw_fac*lambda_z)
              delta(2)=1D0/maxw_fac
           endif
           if (0D0 .lt. delta(1) .and. delta(1) .lt. 1) then
              spa%delta_z(index_i,spa%spid)=delta(1)
           elseif (0D0 .lt. delta(2) .and. delta(2) .lt. 1) then
              spa%delta_z(index_i,spa%spid)=delta(2)
           else
              write(*,'(a)') 'COL_F_DELTA_INIT: Error (2a-fm) in calculation ' // &
                              ' of finite difference parameter!'
              write(*,'(i8,8(e22.12,1x))') index_i, maxw_fac, lambda_z, delta(1), delta(2),  &
                            spa%mesh_z_half(index_i), spa%numeric_vth2, spa%mesh_dz, arg
              stop
           endif
        enddo

      else   !! ### ----- Inter-species collisions

        numeric_teq    = (spa%den_lambda_gamma*spa%numeric_T + spb%den_lambda_gamma*spb%numeric_T)  &
                         /(spa%den_lambda_gamma+spb%den_lambda_gamma)
        numeric_vtheq2 = numeric_teq*sml_e_charge/spa%mass !  sp%mass --> ptl_mass !! ## ----- this is also problematic correspondingly.

        !! ### ----- R-direction
        !$omp parallel do &
        !$omp default(none) &
        !$omp shared(mesh_Nrm1,spa,spb,numeric_vtheq2) &
        !$omp private(index_j,lambda_r,arg,maxw_fac,delta) num_threads(col_f_i_nthreads)
        do index_j=1, mesh_Nrm1
           lambda_r = -spa%mesh_r_half(index_j)/numeric_vtheq2 * spa%mesh_dr
           arg = (spa%mesh_dr*(spa%mesh_dr+2D0*spa%mesh_r(index_j))/ &
                     (2D0*numeric_vtheq2))
           arg = max(arg_min,min(arg_max, arg))
           if (abs(arg) <= 1.0d-6) then
             maxw_fac = -arg*(1.0d0+arg/2.0d0*(1.0d0+arg/3.0d0))
           else
             maxw_fac=1D0-exp(arg)
           endif
           delta(1)=1D0/maxw_fac-1D0/lambda_r
           delta(2)=1D0/maxw_fac
           if (0D0 .lt. delta(1) .and. delta(1) .lt. 1) then
              spa%delta_r(index_j,spb%spid)=delta(1)
           elseif (0D0 .lt. delta(2) .and. delta(2) .lt. 1) then
              spa%delta_r(index_j,spb%spid)=delta(2)
           else
              write(*,'(a)') 'COL_F_DELTA_INIT: Error (1b-fm) in calculation ' // &
                              ' of finite difference parameter!'
              write(*,'(i8,4(e22.12,1x))') index_j, maxw_fac, lambda_r, delta(1), delta(2)
              stop
           endif
        enddo

        !! ### ----- Z-direction
        !$omp parallel do &
        !$omp default(none) &
        !$omp shared(mesh_Nzm1,spa,spb,numeric_vtheq2) &
        !$omp private(index_i,lambda_z,arg,maxw_fac,delta) num_threads(col_f_i_nthreads)
        do index_i=1, mesh_Nzm1
          lambda_z = -spa%mesh_z_half(index_i)/numeric_vtheq2 * spa%mesh_dz
          arg = (spa%mesh_dz*(spa%mesh_dz+2D0*spa%mesh_z(index_i))/ &
                (2D0*numeric_vtheq2))
          arg = max(arg_min, min(arg_max, arg ))
          if (abs(arg) <= 1.0d-6) then
            maxw_fac = -arg*(1.0d0+arg/2.0d0*(1.0d0+arg/3.0d0))
          else
            maxw_fac = 1.0d0  - exp(arg)
          endif

          !if(abs(cs%mesh_z_half(index_i)) .lt. epsilon(0D0)) then
          if(abs(spa%mesh_z_half(index_i)) .lt. 0.25D0*spa%mesh_dz) then
             delta(1) = 0.5D0
             delta(2) = 0.5D0
          else
             delta(1) = (lambda_z - maxw_fac)/(maxw_fac*lambda_z)
             delta(2)=1D0/maxw_fac
          endif
          if (0D0 .lt. delta(1) .and. delta(1) .lt. 1) then
             spa%delta_z(index_i,spb%spid)=delta(1)
          elseif (0D0 .lt. delta(2) .and. delta(2) .lt. 1) then
             spa%delta_z(index_i,spb%spid)=delta(2)
          else
             write(*,'(a)') 'COL_F_DELTA_INIT: Error (2b-fm) in calculation ' // &
                             ' of finite difference parameter!'
             write(*,'(3(i8,1x),8(e22.12,1x))') spa%spid, spb%spid, index_i, maxw_fac,  &
                      lambda_z, delta(1), delta(2),  &
                      spa%mesh_z_half(index_i), numeric_vtheq2, spa%mesh_dz
             stop
          endif
        enddo
      endif
    end subroutine col_fm_core_delta_init


    ! op_mode==1 for same species, op_mode==2 for different species collision
    ! cell_I and cell_J seem to be cell index  (c.f. grid index)
    ! cs is required for cs%mesh_r_half , cs%mesh_dr/dz
    ! mat_pos_rel_indx
    subroutine col_f_LU_matrix_ftn(op_mode, cell_I, cell_J, cs, mat_pos_rel_indx, mat_pos, coeff1, coeff2, EDs_comp, LU_values)
      implicit none
      integer :: op_mode
      type(col_f_sp_type) :: cs
      integer :: mat_pos_rel_indx(4)
      integer :: mat_pos, cell_I, cell_J
      real (8) :: coeff1, coeff2, coeff_loc1, coeff_loc2
      real (8) :: EDs_comp(5)
      real (kind=8), dimension(LU_nnz) :: LU_values
      real (8) :: M_rr_fOVERdr, M_rz_fOVERdz, M_zz_fOVERdz, M_zr_fOVERdr, tmp_ER_sum, tmp_EZ_sum, delr, cdelr, delz, cdelz

      coeff_loc1 = coeff1*cs%mesh_r_half(cell_J)
      coeff_loc2 = coeff2*cs%mesh_r_half(cell_J)
      ! EDs = 1: Drr, 2: Drz, 3:Dzz, 4:Dzr, 5: Er, 6:Ez
      M_rr_fOVERdr = EDs_comp(1)/cs%mesh_dr
      M_rz_fOVERdz = EDs_comp(2)/cs%mesh_dz
      M_zr_fOVERdr = EDs_comp(2)/cs%mesh_dr
      M_zz_fOVERdz = EDs_comp(3)/cs%mesh_dz
      tmp_ER_sum   = EDs_comp(4)
      tmp_EZ_sum   = EDs_comp(5)

      delr = cs%delta_r(cell_J,op_mode)
      cdelr = (1D0-delr)
      delz = cs%delta_z(cell_I,op_mode)
      cdelz = (1D0-delz)


      !for (I,J)
      LU_values(index_map_LU(mat_pos_rel_indx(1),mat_pos)) = LU_values(index_map_LU(mat_pos_rel_indx(1),mat_pos)) &
                                 + coeff_loc1* (tmp_ER_sum*delr*delz - M_rr_fOVERdr*(-delz) - M_rz_fOVERdz*(-delr)) &
                                 + coeff_loc2* (tmp_EZ_sum*delr*delz - M_zr_fOVERdr*(-delz) - M_zz_fOVERdz*(-delr))
      !for (I,J+1)
      LU_values(index_map_LU(mat_pos_rel_indx(2),mat_pos)) = LU_values(index_map_LU(mat_pos_rel_indx(2),mat_pos)) &
                                 + coeff_loc1* (tmp_ER_sum*cdelr*delz - M_rr_fOVERdr*(delz) - M_rz_fOVERdz*(-cdelr)) &
                                 + coeff_loc2* (tmp_EZ_sum*cdelr*delz - M_zr_fOVERdr*(delz) - M_zz_fOVERdz*(-cdelr))
      !for(I+1,J)
      LU_values(index_map_LU(mat_pos_rel_indx(3),mat_pos)) = LU_values(index_map_LU(mat_pos_rel_indx(3),mat_pos)) &
                                 + coeff_loc1* (tmp_ER_sum*delr*cdelz - M_rr_fOVERdr*(-cdelz) - M_rz_fOVERdz*(delr)) &
                                 + coeff_loc2* (tmp_EZ_sum*delr*cdelz - M_zr_fOVERdr*(-cdelz) - M_zz_fOVERdz*(delr))
      !for(I+1,J+1)
      LU_values(index_map_LU(mat_pos_rel_indx(4),mat_pos)) = LU_values(index_map_LU(mat_pos_rel_indx(4),mat_pos)) &
                                 + coeff_loc1* (tmp_ER_sum*cdelr*cdelz - M_rr_fOVERdr*(cdelz) - M_rz_fOVERdz*(cdelr)) &
                                 + coeff_loc2* (tmp_EZ_sum*cdelr*cdelz - M_zr_fOVERdr*(cdelz) - M_zz_fOVERdz*(cdelr))

      return

    end subroutine col_f_LU_matrix_ftn


    subroutine col_f_LU_matrix(op_mode, cs, EDs, LU_values)
      ! EDs : target
      implicit none
      integer :: op_mode
      type(col_f_sp_type) :: cs
      real (8), dimension(5,col_f_nvr-1, col_f_nvz-1) :: EDs
      real (kind=8), dimension(LU_nnz) :: LU_values
      integer :: index_I, index_J, cell_I, cell_J, mesh_Nr, mesh_Nz
      integer :: mat_pos_rel_indx(4)
      real (8) :: coeff1_ab, coeff2_ab, coeff1, coeff2, local_vol
      real (8) :: M_rr_fOVERdr, M_rz_fOVERdz, M_zz_fOVERdz, M_zr_fOVERdr, tmp_ER_sum, tmp_EZ_sum, delr, cdelr, delz, cdelz
      integer :: local_ij, local_i, local_j, mat_pos, mat_pos_d

      mesh_Nr = col_f_nvr
      mesh_Nz = col_f_nvz

      LU_values(:) = 0D0
      do index_I=1,mesh_Nz
          do index_J=1, mesh_Nr
             mat_pos = index_J+(index_I-1)*col_f_nvr
             ! What we know : the number of cells related to cell (J,I) from LU_colptr
             !                index number of relevant cells from LU_rowindx
      
             ! NOTE that local_vol is for volume in LHS. Therefore, fixed values!
             local_vol = cs%vol(index_J)
             coeff1_ab    = 0.5D0*cs%mesh_dz/local_vol
             coeff2_ab    = 0.5D0*cs%mesh_dr/local_vol

             if((index_I .ne. mesh_Nz) .and. (index_J .ne. mesh_Nr)) then
             ! Existence of (I+1/2, J+1/2)
                 cell_I = index_I
                 cell_J = index_J
                 mat_pos_rel_indx=(/5, 6, 8, 9/) !just reuse array
                 coeff1 = -coeff1_ab
                 coeff2 = -coeff2_ab
                 call col_f_LU_matrix_ftn(op_mode, cell_I, cell_J, cs, mat_pos_rel_indx, mat_pos, coeff1, coeff2, EDs(:,cell_J,cell_I), LU_values)
             endif

             if((index_I .ne. 1) .and. (index_J .ne. mesh_Nr)) then
             ! Existence of (I-1/2, J+1/2)
                 cell_I = index_I-1
                 cell_J = index_J
                 mat_pos_rel_indx=(/2, 3, 5, 6/)
                 coeff1 = -coeff1_ab
                 coeff2 =  coeff2_ab
                 call col_f_LU_matrix_ftn(op_mode, cell_I, cell_J, cs, mat_pos_rel_indx, mat_pos, coeff1, coeff2, EDs(:,cell_J,cell_I), LU_values)
             endif

             if((index_I .ne. mesh_Nz) .and. (index_J .ne. 1)) then
             ! Existence of (I+1/2, J-1/2)
                 cell_I = index_I
                 cell_J = index_J-1
                 mat_pos_rel_indx=(/4, 5, 7, 8/)
                 coeff1 =  coeff1_ab
                 coeff2 = -coeff2_ab
                 call col_f_LU_matrix_ftn(op_mode, cell_I, cell_J, cs, mat_pos_rel_indx, mat_pos, coeff1, coeff2, EDs(:,cell_J,cell_I), LU_values)
             endif

             if( (index_I .ne. 1) .and. (index_J .ne. 1) ) then
             ! Existence of (I-1/2, J-1/2)
                 cell_I = index_I-1
                 cell_J = index_J-1
                 mat_pos_rel_indx=(/1, 2, 4, 5/)
                 coeff1 = coeff1_ab
                 coeff2 = coeff2_ab
                 call col_f_LU_matrix_ftn(op_mode, cell_I, cell_J, cs, mat_pos_rel_indx, mat_pos, coeff1, coeff2, EDs(:,cell_J,cell_I), LU_values)
             endif

          enddo !index_J
      enddo !index_I

    end subroutine col_f_LU_matrix



end module col_f_module





